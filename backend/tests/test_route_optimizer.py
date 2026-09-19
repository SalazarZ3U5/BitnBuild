"""
Tests for route_optimizer.py — deterministic logic.
"""
import sys
import os
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_haversine_distance():
    """Haversine should give a known distance between two points."""
    from app.ml.route_optimizer import haversine_km

    # Ahmedabad city center to GIFT City / Gandhinagar (~24km)
    dist = haversine_km(23.0225, 72.5714, 23.2156, 72.6840)
    assert 20 < dist < 30, f"Expected ~24km, got {dist}"


def test_haversine_same_point():
    """Distance from a point to itself should be 0."""
    from app.ml.route_optimizer import haversine_km

    dist = haversine_km(12.9716, 77.5946, 12.9716, 77.5946)
    assert dist == 0


def test_build_distance_matrix():
    """Distance matrix should be symmetric and have zero diagonal."""
    from app.ml.route_optimizer import _build_distance_matrix_haversine

    locations = [
        (12.97, 77.59),
        (12.98, 77.60),
        (12.96, 77.58),
    ]
    matrix = _build_distance_matrix_haversine(locations)

    assert len(matrix) == 3
    for i in range(3):
        assert matrix[i][i] == 0
        for j in range(3):
            # Should be roughly symmetric (integer rounding may differ by 1)
            assert abs(matrix[i][j] - matrix[j][i]) <= 1


def test_fallback_round_robin():
    """Fallback should assign bins to vehicles in round-robin fashion."""
    from app.ml.route_optimizer import _fallback_round_robin, _build_distance_matrix_haversine
    from app.models import Bin, Vehicle

    bins = []
    for i in range(6):
        b = MagicMock(spec=Bin)
        b.id = i + 1
        b.name = f"Bin {i+1}"
        b.lat = 12.97 + i * 0.01
        b.lng = 77.59 + i * 0.01
        b.current_fill_percent = 70 + i * 5
        b.capacity_liters = 240
        bins.append(b)

    vehicles = []
    for i in range(2):
        v = MagicMock(spec=Vehicle)
        v.id = i + 1
        v.name = f"Truck {i+1}"
        v.capacity_liters = 5000
        v.depot_lat = 12.97
        v.depot_lng = 77.59
        vehicles.append(v)

    locations = [(12.97, 77.59)] + [(b.lat, b.lng) for b in bins]
    matrix = _build_distance_matrix_haversine(locations)

    db = MagicMock()
    db.add = MagicMock()
    db.flush = MagicMock()
    db.commit = MagicMock()

    route_obj = MagicMock()
    route_obj.id = 1

    result = _fallback_round_robin(db, bins, vehicles, matrix)

    assert "routes" in result
    assert len(result["routes"]) == 2  # 2 vehicles
    total_stops = sum(len(r["stops"]) for r in result["routes"])
    assert total_stops == 6  # All bins assigned


def test_optimize_routes_no_bins():
    """Should return empty routes if no bins above threshold."""
    from app.ml.route_optimizer import optimize_routes

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []

    result = optimize_routes(db, fill_threshold=60.0)
    assert result["routes"] == []
