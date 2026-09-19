"""
Tests for prioritizer.py — deterministic priority scoring.
"""
import sys
import os
import pytest
from unittest.mock import MagicMock, patch

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.models import Bin, WasteType


def make_bin(id, fill_percent, waste_type, lat=12.97, lng=77.59, zone="A"):
    """Create a mock Bin object for testing."""
    bin_obj = MagicMock(spec=Bin)
    bin_obj.id = id
    bin_obj.name = f"Test Bin {id}"
    bin_obj.current_fill_percent = fill_percent
    bin_obj.waste_type = waste_type
    bin_obj.lat = lat
    bin_obj.lng = lng
    bin_obj.zone = zone
    return bin_obj


@patch("app.ml.prioritizer.predict_overflow")
def test_higher_fill_gets_higher_priority(mock_predict):
    """A bin at 90% should score higher than one at 20%, all else equal."""
    from app.ml.prioritizer import compute_priorities

    mock_predict.return_value = {"hours_until_overflow": 24}

    db = MagicMock()
    bin_high = make_bin(1, 90.0, WasteType.PLASTIC)
    bin_low = make_bin(2, 20.0, WasteType.PLASTIC)
    db.query.return_value.all.return_value = [bin_high, bin_low]

    result = compute_priorities(db)

    assert len(result) == 2
    assert result[0]["bin_id"] == 1  # Higher fill first
    assert result[0]["priority_score"] > result[1]["priority_score"]


@patch("app.ml.prioritizer.predict_overflow")
def test_organic_gets_higher_waste_weight(mock_predict):
    """Organic waste should get a higher waste_type_component than glass."""
    from app.ml.prioritizer import compute_priorities

    mock_predict.return_value = {"hours_until_overflow": 48}

    db = MagicMock()
    bin_organic = make_bin(1, 60.0, WasteType.ORGANIC)
    bin_glass = make_bin(2, 60.0, WasteType.GLASS)
    db.query.return_value.all.return_value = [bin_organic, bin_glass]

    result = compute_priorities(db)

    organic_score = next(r for r in result if r["bin_id"] == 1)
    glass_score = next(r for r in result if r["bin_id"] == 2)

    assert organic_score["waste_type_component"] > glass_score["waste_type_component"]


@patch("app.ml.prioritizer.predict_overflow")
def test_empty_bins_returns_empty(mock_predict):
    """No bins → empty priority list."""
    from app.ml.prioritizer import compute_priorities

    db = MagicMock()
    db.query.return_value.all.return_value = []

    result = compute_priorities(db)
    assert result == []


@patch("app.ml.prioritizer.predict_overflow")
def test_priority_score_range(mock_predict):
    """Priority score should be between 0 and 1."""
    from app.ml.prioritizer import compute_priorities

    mock_predict.return_value = {"hours_until_overflow": 12}

    db = MagicMock()
    bins = [make_bin(i, i * 10, WasteType.PLASTIC) for i in range(1, 11)]
    db.query.return_value.all.return_value = bins

    result = compute_priorities(db)

    for r in result:
        assert 0 <= r["priority_score"] <= 1.0, f"Score {r['priority_score']} out of range"
