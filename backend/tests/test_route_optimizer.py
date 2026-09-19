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


def test_river_aware_distance_penalizes_river_crossing():
    """Cross-river distance must be significantly greater than straight-line distance due to bridge routing."""
    from app.ml.route_optimizer import river_aware_distance_km, haversine_km

    # Navrangpura (West, lng ~72.556) to Khadia (East, lng ~72.581)
    west_lat, west_lng = 23.0345, 72.5564
    east_lat, east_lng = 23.0225, 72.5814

    straight_dist = haversine_km(west_lat, west_lng, east_lat, east_lng)
    river_dist = river_aware_distance_km(west_lat, west_lng, east_lat, east_lng)

    assert river_dist > straight_dist * 1.3, f"River dist ({river_dist}) should exceed straight dist ({straight_dist}) with bridge routing"


def test_route_geometry_includes_coordinates():
    """Route road geometry must return a valid list of [lat, lng] coordinates."""
    from app.ml.route_optimizer import get_route_road_geometry

    depot = {"lat": 23.0345, "lng": 72.5564}
    stops = [
        {"lat": 23.0380, "lng": 72.5590},
        {"lat": 23.0410, "lng": 72.5620},
    ]

    geometry, dist_km = get_route_road_geometry(depot, stops)
    assert len(geometry) >= 3
    assert dist_km > 0
    for pt in geometry:
        assert len(pt) == 2
        assert 22.0 < pt[0] < 24.0  # valid Ahmedabad latitude
        assert 72.0 < pt[1] < 73.0  # valid Ahmedabad longitude


def test_cluster_bins_separates_river_banks():
    """West bins should primarily be assigned to West depots and East bins to East depots."""
    from app.ml.route_optimizer import _cluster_bins_by_vehicle
    from app.models import Bin, Vehicle

    west_vehicle = MagicMock(spec=Vehicle)
    west_vehicle.id = 1
    west_vehicle.depot_lat = 23.0345
    west_vehicle.depot_lng = 72.5400  # Far West

    east_vehicle = MagicMock(spec=Vehicle)
    east_vehicle.id = 2
    east_vehicle.depot_lat = 23.0125
    east_vehicle.depot_lng = 72.6100  # Far East

    west_bin = MagicMock(spec=Bin)
    west_bin.id = 101
    west_bin.lat = 23.0350
    west_bin.lng = 72.5350  # West

    east_bin = MagicMock(spec=Bin)
    east_bin.id = 102
    east_bin.lat = 23.0130
    east_bin.lng = 72.6150  # East

    clusters = _cluster_bins_by_vehicle([west_bin, east_bin], [west_vehicle, east_vehicle])
    assert len(clusters) == 2
    assert west_bin in clusters[0]
    assert east_bin in clusters[1]

