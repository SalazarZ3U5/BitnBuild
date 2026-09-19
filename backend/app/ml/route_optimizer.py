"""
Route optimizer — Capacitated VRP solved with Google OR-Tools and river-aware clustering.
Ahmedabad Municipal Corporation (AMC) Waste Management Route Planning.
Models the Sabarmati River barrier, routes across actual road bridges,
and generates street-snapped geometries via OSRM.
"""
import math
import datetime
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from app.models import Bin, Vehicle, Route, RouteStop

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

# Sabarmati River divide in central Ahmedabad:
# West of river: lng < 72.5715
# East of river: lng > 72.5715
RIVER_LNG_THRESHOLD = 72.5715

# Real road bridges connecting West and East Ahmedabad across the Sabarmati River:
AHMEDABAD_BRIDGES = [
    (23.0645, 72.5835),  # Subhash Bridge (North)
    (23.0410, 72.5732),  # Gandhi Bridge (Income Tax / Old City North)
    (23.0282, 72.5715),  # Nehru Bridge (Navrangpura / Lal Darwaja)
    (23.0225, 72.5710),  # Ellis Bridge / Swami Vivekananda Bridge (Paldi / Bhadra)
    (23.0112, 72.5695),  # Sardar Bridge (Paldi / Jamalpur)
    (22.9960, 72.5645),  # Dr. Ambedkar Bridge (Vasna / Danilimda)
]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance between two lat/lng points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def river_aware_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Computes realistic urban driving distance between two points, factoring in the Sabarmati River.
    If points are on opposite sides of the river, driving must route through the nearest bridge,
    adding bridge transit and approach overhead.
    """
    crosses_river = (lng1 < RIVER_LNG_THRESHOLD and lng2 > RIVER_LNG_THRESHOLD) or \
                    (lng1 > RIVER_LNG_THRESHOLD and lng2 < RIVER_LNG_THRESHOLD)
    
    if not crosses_river:
        # Same side of river: urban road network tortuosity factor (~1.25x haversine)
        return haversine_km(lat1, lng1, lat2, lng2) * 1.25

    # Must cross via one of Ahmedabad's bridges
    best_bridge_dist = float("inf")
    for b_lat, b_lng in AHMEDABAD_BRIDGES:
        d = haversine_km(lat1, lng1, b_lat, b_lng) + haversine_km(b_lat, b_lng, lat2, lng2)
        if d < best_bridge_dist:
            best_bridge_dist = d

    # Bridge transit and traffic approach overhead (~1.5 km equivalent)
    return best_bridge_dist * 1.25 + 1.5


def _build_distance_matrix_haversine(locations: list[tuple[float, float]]) -> list[list[int]]:
    """Build a distance matrix using haversine (meters, integer)."""
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                d = haversine_km(locations[i][0], locations[i][1],
                                 locations[j][0], locations[j][1])
                matrix[i][j] = int(d * 1000)  # meters
    return matrix


def _build_river_aware_distance_matrix(locations: list[tuple[float, float]]) -> list[list[int]]:
    """Build a distance matrix using river-aware driving distance (meters, integer)."""
    n = len(locations)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                d = river_aware_distance_km(locations[i][0], locations[i][1],
                                            locations[j][0], locations[j][1])
                matrix[i][j] = int(d * 1000)  # meters
    return matrix


def _try_osrm_distance_matrix(locations: list[tuple[float, float]]) -> list[list[int]] | None:
    """Try to get a distance matrix from the OSRM public demo server."""
    if not HAS_HTTPX or len(locations) > 25:
        return None

    coords = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"https://router.project-osrm.org/table/v1/driving/{coords}?annotations=distance"

    try:
        with httpx.Client(timeout=1.5) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok":
                    durations = data["distances"]
                    return [[int(d) for d in row] for row in durations]
    except Exception:
        pass
    return None


_GEOMETRY_CACHE = {}


def get_route_road_geometry(depot: dict, stops: list[dict]) -> tuple[list[list[float]], float]:
    """
    Fetches actual road-snapped polyline coordinates for a vehicle route using OSRM.
    Uses in-memory caching and fast 1.5s timeout with instant bridge fallback for sub-second responses.
    """
    ordered_pts = [(depot["lat"], depot["lng"])] + [(s["lat"], s["lng"]) for s in stops] + [(depot["lat"], depot["lng"])]
    if len(ordered_pts) < 2:
        return [[p[0], p[1]] for p in ordered_pts], 0.0

    cache_key = tuple((round(p[0], 4), round(p[1], 4)) for p in ordered_pts)
    if cache_key in _GEOMETRY_CACHE:
        return _GEOMETRY_CACHE[cache_key]

    # Try fast OSRM route service
    if HAS_HTTPX:
        try:
            coords_str = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in ordered_pts)
            url = f"https://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"
            with httpx.Client(timeout=1.5) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("code") == "Ok" and data.get("routes"):
                        route_info = data["routes"][0]
                        coords = [[pt[1], pt[0]] for pt in route_info["geometry"]["coordinates"]]
                        dist_km = round(route_info["distance"] / 1000.0, 2)
                        _GEOMETRY_CACHE[cache_key] = (coords, dist_km)
                        return coords, dist_km
        except Exception:
            pass

    # Instant Fallback: bridge-respecting waypoints so lines NEVER cross the river water
    fallback_coords = []
    total_dist = 0.0
    for i in range(len(ordered_pts) - 1):
        p1 = ordered_pts[i]
        p2 = ordered_pts[i + 1]
        fallback_coords.append([p1[0], p1[1]])
        
        # Check if segment crosses river
        if (p1[1] < RIVER_LNG_THRESHOLD and p2[1] > RIVER_LNG_THRESHOLD) or \
           (p1[1] > RIVER_LNG_THRESHOLD and p2[1] < RIVER_LNG_THRESHOLD):
            nearest_bridge = min(
                AHMEDABAD_BRIDGES,
                key=lambda b: haversine_km(p1[0], p1[1], b[0], b[1]) + haversine_km(b[0], b[1], p2[0], p2[1])
            )
            fallback_coords.append([nearest_bridge[0], nearest_bridge[1]])
        
        total_dist += river_aware_distance_km(p1[0], p1[1], p2[0], p2[1])
    
    fallback_coords.append([ordered_pts[-1][0], ordered_pts[-1][1]])
    result = (fallback_coords, round(total_dist, 2))
    _GEOMETRY_CACHE[cache_key] = result
    return result


def _solve_tsp_2opt(depot_coord: tuple[float, float], stops: list[dict]) -> list[dict]:
    """
    Orders stops using nearest-neighbor heuristic followed by 2-opt swaps,
    strictly respecting river-aware distances.
    Guarantees clean, smooth municipal loops starting and ending at the depot.
    """
    n = len(stops)
    if n <= 1:
        for i, s in enumerate(stops):
            s["stop_order"] = i
        return stops

    # Nodes: 0 = depot, 1..n = stops
    nodes = [depot_coord] + [(s["lat"], s["lng"]) for s in stops]
    num_nodes = len(nodes)

    # Precompute river-aware distance matrix
    dist = [[0.0] * num_nodes for _ in range(num_nodes)]
    for i in range(num_nodes):
        for j in range(num_nodes):
            if i != j:
                dist[i][j] = river_aware_distance_km(nodes[i][0], nodes[i][1], nodes[j][0], nodes[j][1])

    # 1. Greedy nearest-neighbor tour
    unvisited = set(range(1, num_nodes))
    current = 0
    tour = []
    while unvisited:
        next_node = min(unvisited, key=lambda node: dist[current][node])
        tour.append(next_node)
        unvisited.remove(next_node)
        current = next_node

    # 2. 2-opt refinement
    improved = True
    iteration = 0
    while improved and iteration < 50:
        improved = False
        iteration += 1
        for i in range(len(tour) - 1):
            for j in range(i + 1, len(tour)):
                prev_i = 0 if i == 0 else tour[i - 1]
                node_i = tour[i]
                node_j = tour[j]
                next_j = 0 if j == len(tour) - 1 else tour[j + 1]

                # Current cost of edges (prev_i -> node_i) and (node_j -> next_j)
                cur_cost = dist[prev_i][node_i] + dist[node_j][next_j]
                # New cost if tour[i:j+1] reversed
                new_cost = dist[prev_i][node_j] + dist[node_i][next_j]

                if new_cost < cur_cost - 1e-4:
                    tour[i:j + 1] = reversed(tour[i:j + 1])
                    improved = True
                    break
            if improved:
                break

    # Build reordered stops list
    ordered_stops = []
    for order, node_idx in enumerate(tour):
        stop_dict = dict(stops[node_idx - 1])
        stop_dict["stop_order"] = order
        ordered_stops.append(stop_dict)

    return ordered_stops


def _cluster_bins_by_vehicle(bins: list[Bin], vehicles: list[Vehicle]) -> list[list[Bin]]:
    """
    Cluster bins among active vehicles using river-aware distance to vehicle depots.
    Balances workload across vehicles so no vehicle is overloaded or left idle,
    while strictly minimizing cross-city and cross-river travel.
    """
    num_vehicles = len(vehicles)
    if num_vehicles == 0:
        return []
    if num_vehicles == 1:
        return [list(bins)]

    target_per_vehicle = math.ceil(len(bins) / num_vehicles)
    max_per_vehicle = target_per_vehicle + 3

    # Calculate affinity gap for each bin (difference between closest and 2nd closest vehicle depot)
    bin_preferences = []
    for b in bins:
        dists = []
        for v_idx, v in enumerate(vehicles):
            d = river_aware_distance_km(v.depot_lat, v.depot_lng, b.lat, b.lng)
            dists.append((d, v_idx))
        dists.sort(key=lambda x: x[0])
        gap = (dists[1][0] - dists[0][0]) if len(dists) > 1 else dists[0][0]
        bin_preferences.append((gap, b, dists))

    # Assign bins with highest affinity gap first (most geographically distinct)
    bin_preferences.sort(key=lambda x: x[0], reverse=True)

    clusters = [[] for _ in range(num_vehicles)]
    for gap, b, dists in bin_preferences:
        assigned = False
        for dist, v_idx in dists:
            if len(clusters[v_idx]) < max_per_vehicle:
                clusters[v_idx].append(b)
                assigned = True
                break
        if not assigned:
            min_v_idx = min(range(num_vehicles), key=lambda i: len(clusters[i]))
            clusters[min_v_idx].append(b)

    return clusters


def optimize_routes(db: Session, fill_threshold: float = 50.0) -> dict:
    """
    Generate optimized routes for today's collection.

    1. Select bins needing collection (critical or >= fill_threshold).
    2. Ensure 4 active vehicles covering Ahmedabad zones.
    3. Cluster bins by vehicle depot affinity with river-awareness.
    4. Optimize stop ordering for each vehicle.
    5. Fetch road network geometry from OSRM following actual streets and bridges.
    6. Store routes in DB and return all paths.
    """
    # Check if all or most bins are critical
    all_db_bins = db.query(Bin).all()
    critical_count = 0
    if isinstance(all_db_bins, list):
        try:
            critical_count = sum(1 for b in all_db_bins if getattr(b, 'current_fill_percent', 0.0) >= 80.0)
        except Exception:
            critical_count = 0

    if critical_count >= 30 or fill_threshold <= 50.0:
        bins = all_db_bins if isinstance(all_db_bins, list) else []
    else:
        bins = (
            db.query(Bin)
            .filter(Bin.current_fill_percent >= fill_threshold)
            .all()
        )

    if not bins:
        return {"message": "No bins found in database", "routes": []}

    # Ensure 4 active vehicles
    vehicles = db.query(Vehicle).filter(Vehicle.is_active == True).order_by(Vehicle.id).all()
    if len(vehicles) < 4:
        from app.simulation.generate_synthetic_data import generate_vehicles
        db.query(Vehicle).delete()
        vehicles = generate_vehicles(db)
        db.commit()

    if not vehicles:
        return {"message": "No active vehicles", "routes": []}

    num_vehicles = min(len(vehicles), 4)
    active_vehicles = vehicles[:num_vehicles]

    # Cluster bins by vehicle depot / zone affinity
    clusters = _cluster_bins_by_vehicle(bins, active_vehicles)

    now = datetime.datetime.now(datetime.timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Clear today's existing routes
    db.query(RouteStop).delete()
    db.query(Route).filter(Route.date >= today).delete()
    db.flush()

    # Prepare ordered stops for each vehicle
    prepared = []
    for v_idx in range(num_vehicles):
        vehicle = active_vehicles[v_idx]
        assigned_bins = clusters[v_idx]
        depot_dict = {"lat": vehicle.depot_lat, "lng": vehicle.depot_lng}

        raw_stops = [{
            "bin_id": b.id,
            "bin_name": b.name,
            "lat": b.lat,
            "lng": b.lng,
            "fill_percent": b.current_fill_percent,
            "stop_order": 0,
        } for b in assigned_bins]

        # Optimize stops ordering using 2-opt TSP with river-aware distance
        ordered_stops = _solve_tsp_2opt((vehicle.depot_lat, vehicle.depot_lng), raw_stops)
        prepared.append((vehicle, depot_dict, ordered_stops))

    # Fetch road geometries concurrently across all vehicles in parallel
    with ThreadPoolExecutor(max_workers=max(1, num_vehicles)) as executor:
        geometries = list(executor.map(lambda item: get_route_road_geometry(item[1], item[2]), prepared))

    routes_output = []
    for (vehicle, depot_dict, ordered_stops), (geometry, dist_km) in zip(prepared, geometries):
        # Save to database
        route = Route(
            vehicle_id=vehicle.id,
            date=now,
            total_distance_km=dist_km,
            status="planned",
        )
        db.add(route)
        db.flush()

        for s in ordered_stops:
            rs = RouteStop(
                route_id=route.id,
                bin_id=s["bin_id"],
                stop_order=s["stop_order"],
            )
            db.add(rs)

        routes_output.append({
            "vehicle_id": vehicle.id,
            "vehicle_name": vehicle.name,
            "depot": depot_dict,
            "total_distance_km": dist_km,
            "stops": ordered_stops,
            "geometry": geometry,
        })

    db.commit()

    total_assigned_stops = sum(len(r["stops"]) for r in routes_output)
    return {
        "message": f"Generated {len(routes_output)} river-aware routes covering all {total_assigned_stops} bins",
        "total_bins": total_assigned_stops,
        "routes": routes_output,
    }


def _fallback_round_robin(db, bins, vehicles, matrix):
    """Simple round-robin assignment with river-aware geometry."""
    routes_output = []
    now = datetime.datetime.now(datetime.timezone.utc)
    bins_per_vehicle = max(1, len(bins) // len(vehicles))

    for v_idx, vehicle in enumerate(vehicles):
        start = v_idx * bins_per_vehicle
        end = start + bins_per_vehicle if v_idx < len(vehicles) - 1 else len(bins)
        assigned_bins = bins[start:end]

        if not assigned_bins:
            continue

        depot_dict = {"lat": vehicle.depot_lat, "lng": vehicle.depot_lng}
        stops = []
        for order, b in enumerate(assigned_bins):
            stops.append({
                "bin_id": b.id,
                "bin_name": b.name,
                "lat": b.lat,
                "lng": b.lng,
                "fill_percent": b.current_fill_percent,
                "stop_order": order,
            })

        ordered_stops = _solve_tsp_2opt((vehicle.depot_lat, vehicle.depot_lng), stops)
        geometry, total_dist = get_route_road_geometry(depot_dict, ordered_stops)

        route = Route(
            vehicle_id=vehicle.id,
            date=now,
            total_distance_km=total_dist,
            status="planned",
        )
        db.add(route)
        db.flush()

        for s in ordered_stops:
            rs = RouteStop(route_id=route.id, bin_id=s["bin_id"], stop_order=s["stop_order"])
            db.add(rs)

        routes_output.append({
            "vehicle_id": vehicle.id,
            "vehicle_name": vehicle.name,
            "depot": depot_dict,
            "total_distance_km": total_dist,
            "stops": ordered_stops,
            "geometry": geometry,
        })

    db.commit()
    return {
        "message": f"Fallback routes: {len(routes_output)} routes",
        "total_bins": len(bins),
        "routes": routes_output,
    }


def optimize_routes_predictive(db: Session, dispatch_at_hours: float = 12.0) -> dict:
    """
    Generate optimized routes based on PREDICTED fill levels at dispatch_at_hours from now.
    Bins predicted to exceed 60% fill at that future time are included.
    Includes road-snapped geometries following streets and bridges.
    """
    from app.ml.fill_predictor import predict_fill_at

    all_bins = db.query(Bin).all()
    vehicles = db.query(Vehicle).filter(Vehicle.is_active == True).order_by(Vehicle.id).all()

    if not vehicles:
        return {"message": "No active vehicles", "routes": []}

    # Predict fill for all bins at dispatch time
    predictions = []
    for b in all_bins:
        try:
            pred = predict_fill_at(db, b, dispatch_at_hours)
            pred["_bin_obj"] = b
            predictions.append(pred)
        except Exception:
            predictions.append({
                "bin_id": b.id,
                "predicted_fill_percent": b.current_fill_percent or 0.0,
                "will_overflow_before": False,
                "_bin_obj": b,
            })

    # Include bins predicted to be >= 60% full at dispatch time
    threshold = 60.0
    bins_to_collect = [p["_bin_obj"] for p in predictions if p.get("predicted_fill_percent", 0) >= threshold]

    if not bins_to_collect:
        predictions.sort(key=lambda x: x.get("predicted_fill_percent", 0), reverse=True)
        bins_to_collect = [p["_bin_obj"] for p in predictions[:20]]

    pred_lookup = {p["bin_id"]: p.get("predicted_fill_percent", 0) for p in predictions}

    num_vehicles = min(len(vehicles), 4)
    active_vehicles = vehicles[:num_vehicles]

    clusters = _cluster_bins_by_vehicle(bins_to_collect, active_vehicles)
    dispatch_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=dispatch_at_hours)

    prepared = []
    for v_idx in range(num_vehicles):
        vehicle = active_vehicles[v_idx]
        assigned_bins = clusters[v_idx]
        depot_dict = {"lat": vehicle.depot_lat, "lng": vehicle.depot_lng}

        raw_stops = [{
            "bin_id": b.id,
            "bin_name": b.name,
            "lat": b.lat,
            "lng": b.lng,
            "fill_percent": round(pred_lookup.get(b.id, b.current_fill_percent or 0), 2),
            "current_fill_percent": b.current_fill_percent,
            "predicted_fill_percent": round(pred_lookup.get(b.id, b.current_fill_percent or 0), 2),
            "stop_order": 0,
        } for b in assigned_bins]

        ordered_stops = _solve_tsp_2opt((vehicle.depot_lat, vehicle.depot_lng), raw_stops)
        prepared.append((vehicle, depot_dict, ordered_stops))

    with ThreadPoolExecutor(max_workers=max(1, num_vehicles)) as executor:
        geometries = list(executor.map(lambda item: get_route_road_geometry(item[1], item[2]), prepared))

    routes_output = []
    for (vehicle, depot_dict, ordered_stops), (geometry, dist_km) in zip(prepared, geometries):
        routes_output.append({
            "vehicle_id": vehicle.id,
            "vehicle_name": vehicle.name,
            "depot": depot_dict,
            "total_distance_km": dist_km,
            "stops": ordered_stops,
            "geometry": geometry,
            "dispatch_at": dispatch_at.isoformat(),
            "hours_ahead": dispatch_at_hours,
            "is_predictive": True,
        })

    return {
        "message": f"Predictive routes for T+{dispatch_at_hours}h covering {len(bins_to_collect)} bins predicted to need collection",
        "total_bins": len(bins_to_collect),
        "dispatch_at": dispatch_at.isoformat(),
        "hours_ahead": dispatch_at_hours,
        "routes": routes_output,
    }
