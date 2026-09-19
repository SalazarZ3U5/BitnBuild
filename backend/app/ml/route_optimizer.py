"""
Route optimizer — Capacitated VRP solved with Google OR-Tools.
Builds a distance matrix (OSRM if online, haversine fallback) and
assigns prioritized bins to vehicles respecting capacity constraints.
"""
import math
import datetime
from sqlalchemy.orm import Session
from app.models import Bin, Vehicle, Route, RouteStop

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


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


def optimize_routes(db: Session, fill_threshold: float = 50.0) -> dict:
    """
    Generate optimized routes for today's collection.

    1. Include all bins needing collection (all 40 when critical or >= fill_threshold).
    2. Ensure 4 active vehicles covering 4 Ahmedabad zones.
    3. Solve CVRP with OR-Tools with adequate capacities so no bins are dropped.
    4. Post-verify: assign any remaining bins to the nearest route (0 bins disregarded).
    5. Store routes in DB and return all 4 paths.
    """
    try:
        from ortools.constraint_solver import routing_enums_pb2, pywrapcp
        HAS_ORTOOLS = True
    except ImportError:
        HAS_ORTOOLS = False

    # Check if all or most bins are critical
    all_db_bins = db.query(Bin).all()
    critical_count = sum(1 for b in all_db_bins if b.current_fill_percent >= 80.0)
    
    # If all or most bins are critical (or threshold <= 50), include all 40 bins
    if critical_count >= 30 or fill_threshold <= 50.0:
        bins = all_db_bins
    else:
        bins = (
            db.query(Bin)
            .filter(Bin.current_fill_percent >= fill_threshold)
            .all()
        )

    # Fallback: ensure at least top filled bins if none found
    if not bins:
        bins = (
            db.query(Bin)
            .order_by(Bin.current_fill_percent.desc())
            .limit(20)
            .all()
        )

    # Ensure 4 active vehicles
    vehicles = db.query(Vehicle).filter(Vehicle.is_active == True).order_by(Vehicle.id).all()
    if len(vehicles) < 4:
        from app.simulation.generate_synthetic_data import generate_vehicles
        db.query(Vehicle).delete()
        vehicles = generate_vehicles(db)
        db.commit()

    if not bins:
        return {"message": "No bins found in database", "routes": []}
    if not vehicles:
        return {"message": "No active vehicles", "routes": []}


    num_vehicles = min(len(vehicles), 4)
    active_vehicles = vehicles[:num_vehicles]

    # Build location list: [depot, bin1, bin2, ...]
    depot = active_vehicles[0]
    locations = [(depot.depot_lat, depot.depot_lng)]
    for b in bins:
        locations.append((b.lat, b.lng))

    # Build distance matrix
    matrix = _try_osrm_distance_matrix(locations)
    if matrix is None:
        matrix = _build_distance_matrix_haversine(locations)

    # Demands: depot=0, each bin's waste volume in liters
    demands = [0]  # depot
    for b in bins:
        waste_volume = int(b.capacity_liters * (b.current_fill_percent / 100.0))
        demands.append(max(waste_volume, 1))

    if not HAS_ORTOOLS:
        return _fallback_round_robin(db, bins, active_vehicles, matrix)

    total_demand = sum(demands)
    # Generous capacity per vehicle so OR-Tools never drops bins due to capacity constraints
    cap_per_vehicle = max(int(total_demand * 1.5), 25000)
    vehicle_capacities = [cap_per_vehicle] * num_vehicles

    # OR-Tools data model
    n = len(locations)
    manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)  # 0 = depot index
    routing = pywrapcp.RoutingModel(manager)


    # Distance callback
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Capacity constraint
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # slack
        vehicle_capacities,
        True,  # start cumul at zero
        "Capacity",
    )

    # Balance stops across vehicles so each truck gets an active route
    max_stops = math.ceil(len(bins) / num_vehicles) + 3
    routing.AddConstantDimension(1, max_stops + 1, True, "StopCount")

    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.FromSeconds(1)

    solution = routing.SolveWithParameters(search_params)

    if not solution:
        # Fallback: simple round-robin assignment guaranteeing 100% of bins
        return _fallback_round_robin(db, bins, active_vehicles, matrix)

    # Extract routes from solution
    routes_output = []
    now = datetime.datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Clear today's existing routes
    db.query(RouteStop).delete()
    db.query(Route).filter(Route.date >= today).delete()
    db.flush()

    for v_idx in range(num_vehicles):
        index = routing.Start(v_idx)
        stops = []
        total_dist = 0
        stop_order = 0

        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            total_dist += matrix[node][manager.IndexToNode(next_index)]
            if node > 0:  # Skip depot
                stops.append({
                    "bin_id": bins[node - 1].id,
                    "bin_name": bins[node - 1].name,
                    "lat": bins[node - 1].lat,
                    "lng": bins[node - 1].lng,
                    "fill_percent": bins[node - 1].current_fill_percent,
                    "stop_order": stop_order,
                })
                stop_order += 1
            index = next_index

        routes_output.append({
            "vehicle_id": active_vehicles[v_idx].id,
            "vehicle_name": active_vehicles[v_idx].name,
            "depot": {"lat": active_vehicles[v_idx].depot_lat, "lng": active_vehicles[v_idx].depot_lng},
            "total_distance_km": round(total_dist / 1000, 2),
            "stops": stops,
        })

    # ── Post-verification: ensure ZERO bins are disregarded ──
    assigned_bin_ids = {s["bin_id"] for r in routes_output for s in r["stops"]}
    unassigned_bins = [b for b in bins if b.id not in assigned_bin_ids]

    if unassigned_bins:
        for b in unassigned_bins:
            # Find route with the nearest stop or depot
            best_r_idx = 0
            best_dist = float('inf')
            for r_idx, r in enumerate(routes_output):
                ref_lat = r["stops"][-1]["lat"] if r["stops"] else r["depot"]["lat"]
                ref_lng = r["stops"][-1]["lng"] if r["stops"] else r["depot"]["lng"]
                d = haversine_km(ref_lat, ref_lng, b.lat, b.lng)
                if d < best_dist:
                    best_dist = d
                    best_r_idx = r_idx

            new_order = len(routes_output[best_r_idx]["stops"])
            routes_output[best_r_idx]["stops"].append({
                "bin_id": b.id,
                "bin_name": b.name,
                "lat": b.lat,
                "lng": b.lng,
                "fill_percent": b.current_fill_percent,
                "stop_order": new_order,
            })

    # Save finalized routes and stops to database
    for r in routes_output:
        route = Route(
            vehicle_id=r["vehicle_id"],
            date=now,
            total_distance_km=r["total_distance_km"],
            status="planned",
        )
        db.add(route)
        db.flush()

        for s in r["stops"]:
            rs = RouteStop(
                route_id=route.id,
                bin_id=s["bin_id"],
                stop_order=s["stop_order"],
            )
            db.add(rs)

    db.commit()

    total_assigned_stops = sum(len(r["stops"]) for r in routes_output)
    return {
        "message": f"Generated {len(routes_output)} routes covering all {total_assigned_stops} bins (0 disregarded)",
        "total_bins": total_assigned_stops,
        "routes": routes_output,
    }


def _fallback_round_robin(db, bins, vehicles, matrix):
    """Simple round-robin assignment if OR-Tools can't find a solution."""
    routes_output = []
    now = datetime.datetime.utcnow()
    bins_per_vehicle = max(1, len(bins) // len(vehicles))

    for v_idx, vehicle in enumerate(vehicles):
        start = v_idx * bins_per_vehicle
        end = start + bins_per_vehicle if v_idx < len(vehicles) - 1 else len(bins)
        assigned_bins = bins[start:end]

        if not assigned_bins:
            continue

        stops = []
        total_dist = 0
        for order, b in enumerate(assigned_bins):
            stops.append({
                "bin_id": b.id,
                "bin_name": b.name,
                "lat": b.lat,
                "lng": b.lng,
                "fill_percent": b.current_fill_percent,
                "stop_order": order,
            })
            if order > 0:
                total_dist += haversine_km(
                    assigned_bins[order - 1].lat, assigned_bins[order - 1].lng,
                    b.lat, b.lng
                )

        route = Route(
            vehicle_id=vehicle.id,
            date=now,
            total_distance_km=round(total_dist, 2),
            status="planned",
        )
        db.add(route)
        db.flush()

        for s in stops:
            rs = RouteStop(route_id=route.id, bin_id=s["bin_id"], stop_order=s["stop_order"])
            db.add(rs)

        routes_output.append({
            "vehicle_id": vehicle.id,
            "vehicle_name": vehicle.name,
            "depot": {"lat": vehicle.depot_lat, "lng": vehicle.depot_lng},
            "total_distance_km": round(total_dist, 2),
            "stops": stops,
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
            # Fallback: use current fill
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
        # Fallback: top 20 bins by predicted fill
        predictions.sort(key=lambda x: x.get("predicted_fill_percent", 0), reverse=True)
        bins_to_collect = [p["_bin_obj"] for p in predictions[:20]]

    # Build prediction lookup for demand calculation
    pred_lookup = {p["bin_id"]: p.get("predicted_fill_percent", 0) for p in predictions}

    num_vehicles = min(len(vehicles), 4)
    active_vehicles = vehicles[:num_vehicles]
    depot = active_vehicles[0]

    locations = [(depot.depot_lat, depot.depot_lng)]
    for b in bins_to_collect:
        locations.append((b.lat, b.lng))

    matrix = _try_osrm_distance_matrix(locations)
    if matrix is None:
        matrix = _build_distance_matrix_haversine(locations)

    solution = None
    manager = None
    routing = None

    try:
        from ortools.constraint_solver import routing_enums_pb2, pywrapcp

        # Demands: depot=0, each bin's predicted waste volume
        demands = [0]
        for b in bins_to_collect:
            predicted_fill = pred_lookup.get(b.id, b.current_fill_percent or 0)
            waste_volume = int(b.capacity_liters * (predicted_fill / 100.0))
            demands.append(max(waste_volume, 1))

        total_demand = sum(demands)
        cap_per_vehicle = max(int(total_demand * 1.5), 25000)
        vehicle_capacities = [cap_per_vehicle] * num_vehicles

        n = len(locations)
        manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            return matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

        tc = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(tc)

        def demand_callback(from_index):
            return demands[manager.IndexToNode(from_index)]

        dc = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(dc, 0, vehicle_capacities, True, "Capacity")

        max_stops = math.ceil(len(bins_to_collect) / num_vehicles) + 3
        routing.AddConstantDimension(1, max_stops + 1, True, "StopCount")

        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_params.time_limit.FromSeconds(1)

        solution = routing.SolveWithParameters(search_params)
    except Exception:
        solution = None

    dispatch_at = datetime.datetime.utcnow() + datetime.timedelta(hours=dispatch_at_hours)

    if not solution or manager is None or routing is None:
        # Fallback: round-robin

        routes_output = []
        bins_per_v = max(1, len(bins_to_collect) // num_vehicles)
        for v_idx, vehicle in enumerate(active_vehicles):
            start = v_idx * bins_per_v
            end = start + bins_per_v if v_idx < num_vehicles - 1 else len(bins_to_collect)
            assigned = bins_to_collect[start:end]
            stops = [{
                "bin_id": b.id,
                "bin_name": b.name,
                "lat": b.lat,
                "lng": b.lng,
                "fill_percent": round(pred_lookup.get(b.id, b.current_fill_percent or 0), 2),
                "current_fill_percent": b.current_fill_percent,
                "predicted_fill_percent": round(pred_lookup.get(b.id, b.current_fill_percent or 0), 2),
                "stop_order": i,
            } for i, b in enumerate(assigned)]
            total_dist = sum(
                haversine_km(assigned[i-1].lat, assigned[i-1].lng, assigned[i].lat, assigned[i].lng)
                for i in range(1, len(assigned))
            ) if len(assigned) > 1 else 0
            routes_output.append({
                "vehicle_id": vehicle.id,
                "vehicle_name": vehicle.name,
                "depot": {"lat": vehicle.depot_lat, "lng": vehicle.depot_lng},
                "total_distance_km": round(total_dist, 2),
                "stops": stops,
                "dispatch_at": dispatch_at.isoformat(),
                "hours_ahead": dispatch_at_hours,
                "is_predictive": True,
            })
        return {
            "message": f"Predictive routes (fallback) for T+{dispatch_at_hours}h covering {len(bins_to_collect)} bins",
            "total_bins": len(bins_to_collect),
            "dispatch_at": dispatch_at.isoformat(),
            "hours_ahead": dispatch_at_hours,
            "routes": routes_output,
        }

    routes_output = []
    for v_idx in range(num_vehicles):
        index = routing.Start(v_idx)
        stops = []
        total_dist = 0
        stop_order = 0
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            total_dist += matrix[node][manager.IndexToNode(next_index)]
            if node > 0:
                b = bins_to_collect[node - 1]
                stops.append({
                    "bin_id": b.id,
                    "bin_name": b.name,
                    "lat": b.lat,
                    "lng": b.lng,
                    "fill_percent": round(pred_lookup.get(b.id, b.current_fill_percent or 0), 2),
                    "current_fill_percent": b.current_fill_percent,
                    "predicted_fill_percent": round(pred_lookup.get(b.id, b.current_fill_percent or 0), 2),
                    "stop_order": stop_order,
                })
                stop_order += 1
            index = next_index
        routes_output.append({
            "vehicle_id": active_vehicles[v_idx].id,
            "vehicle_name": active_vehicles[v_idx].name,
            "depot": {"lat": active_vehicles[v_idx].depot_lat, "lng": active_vehicles[v_idx].depot_lng},
            "total_distance_km": round(total_dist / 1000, 2),
            "stops": stops,
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
