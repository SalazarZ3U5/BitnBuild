"""
Unit tests for mathematical fill prediction functions in app.ml.fill_predictor.
"""
import sys
import os
import pytest
import numpy as np
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ml.fill_predictor import (
    HOURLY_DIURNAL_WEIGHTS,
    calculate_diurnal_multiplier,
    integrate_diurnal_factor,
    solve_exact_overflow_time,
    fit_accumulation_rate_ols,
    calculate_confidence_bounds,
    classify_collection_urgency,
    predict_fill_at,
    predict_overflow,
)
from app.models import Bin, WasteType, FillReading


def test_diurnal_weights_normalization():
    """Diurnal weights must have exactly 24 hours, sum to 24.0, and have mean of 1.0."""
    assert len(HOURLY_DIURNAL_WEIGHTS) == 24
    assert round(sum(HOURLY_DIURNAL_WEIGHTS), 4) == 24.0
    assert round(float(np.mean(HOURLY_DIURNAL_WEIGHTS)), 4) == 1.0


def test_calculate_diurnal_multiplier_bounds():
    """Diurnal multiplier must be positive and within reasonable human activity bounds."""
    for h in [0.0, 3.5, 9.0, 13.25, 19.5, 23.9]:
        val = calculate_diurnal_multiplier(h)
        assert 0.15 <= val <= 2.5


def test_integrate_diurnal_factor_properties():
    """The integral over 24h must be 24.0 invariant of start time."""
    for start_h in [0.0, 4.25, 8.0, 12.5, 18.0, 23.75]:
        assert round(integrate_diurnal_factor(start_h, 24.0), 3) == 24.0
        assert round(integrate_diurnal_factor(start_h, 48.0), 3) == 48.0
        assert round(integrate_diurnal_factor(start_h, 72.0), 3) == 72.0

    # 0h integral must be 0.0
    assert integrate_diurnal_factor(10.0, 0.0) == 0.0

    # Monotonicity check
    vals = [integrate_diurnal_factor(9.0, h) for h in [0, 6, 12, 24, 36, 48, 72]]
    for i in range(1, len(vals)):
        assert vals[i] >= vals[i - 1]


def test_solve_exact_overflow_time():
    """Root finding for overflow must satisfy physical boundaries."""
    # Full bin overflows immediately
    assert solve_exact_overflow_time(100.0, 2.0, 8.0) == 0.0
    assert solve_exact_overflow_time(105.0, 2.0, 8.0) == 0.0

    # Bin with positive rate has positive finite time to overflow
    t_over = solve_exact_overflow_time(80.0, 2.0, 8.0)
    assert 5.0 <= t_over <= 12.0

    # Nearly empty bin takes much longer than nearly full bin
    t_empty = solve_exact_overflow_time(10.0, 1.5, 8.0)
    t_full = solve_exact_overflow_time(90.0, 1.5, 8.0)
    assert t_empty > t_full

    # Zero or negligible rate returns high threshold
    assert solve_exact_overflow_time(50.0, 0.01, 8.0) == 999.0


def test_fit_accumulation_rate_ols_synthetic_sawtooth():
    """OLS regression on synthetic sawtooth wave must recover the generative slope."""
    # Create 3 sawtooth accumulation cycles with slope ~ 1.5 %/hr
    mock_readings = []
    import datetime
    t0 = datetime.datetime(2026, 1, 1, 0, 0)
    current_time = t0

    for cycle in range(3):
        fill = 5.0
        for hour in range(24):
            reading = MagicMock(spec=FillReading)
            reading.timestamp = current_time
            reading.fill_percent = fill
            mock_readings.append(reading)
            fill += 1.5  # true slope = 1.5 %/hr
            current_time += datetime.timedelta(hours=1)

    mock_bin = MagicMock(spec=Bin)
    mock_bin.name = "Test Bin"
    mock_bin.capacity_liters = 240
    mock_bin.zone = "Central"
    mock_bin.waste_type = WasteType.ORGANIC

    rate, r2, res_std = fit_accumulation_rate_ols(mock_readings, mock_bin)
    # Recovered slope should be close to 1.5 %/hr
    assert abs(rate - 1.5) < 0.1
    assert r2 > 0.95


def test_confidence_bounds():
    """Confidence bounds must widen with horizon and remain clamped within [0, 100]."""
    lower_6h, upper_6h = calculate_confidence_bounds(50.0, 6.0, 1.5, 1.0)
    lower_48h, upper_48h = calculate_confidence_bounds(50.0, 48.0, 1.5, 1.0)

    # 48h interval must be wider than 6h interval
    assert (upper_48h - lower_48h) > (upper_6h - lower_6h)
    assert 0.0 <= lower_6h <= 50.0
    assert 50.0 <= upper_6h <= 100.0


def test_classify_collection_urgency():
    """Urgency thresholds must categorize correctly."""
    assert classify_collection_urgency(85.0, 20.0, 12.0) == "immediate"
    assert classify_collection_urgency(70.0, 5.0, 12.0) == "immediate"  # overflows in 5h <= 12h
    assert classify_collection_urgency(65.0, 14.0, 6.0) == "soon"
    assert classify_collection_urgency(45.0, 30.0, 6.0) == "scheduled"
    assert classify_collection_urgency(20.0, 60.0, 6.0) == "ok"


def test_predict_fill_at_zero_horizon():
    """At T=0, predicted fill must equal current fill."""
    mock_bin = MagicMock(spec=Bin)
    mock_bin.id = 99
    mock_bin.name = "Mock Bin"
    mock_bin.zone = "West Zone"
    mock_bin.waste_type = WasteType.PLASTIC
    mock_bin.lat = 23.02
    mock_bin.lng = 72.57
    mock_bin.capacity_liters = 240
    mock_bin.current_fill_percent = 65.5

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = []

    res = predict_fill_at(mock_db, mock_bin, hours_ahead=0.0)
    assert res["predicted_fill_percent"] == 65.5
    assert res["current_fill_percent"] == 65.5
    assert res["delta_percent"] == 0.0
