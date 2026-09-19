"""
Collection priority scorer.
priority_score = 0.45*fill + 0.30*urgency + 0.15*distance_penalty + 0.10*waste_type_weight
All terms normalized to 0-1 before weighting.
"""
import math
from sqlalchemy.orm import Session
from app.models import Bin, WasteType
from app.ml.fill_predictor import predict_overflow

# Waste type weights: higher = more urgent to collect
WASTE_TYPE_WEIGHTS = {
    WasteType.ORGANIC: 1.0,     # Smells, attracts pests
    WasteType.PLASTIC: 0.5,
    WasteType.PAPER: 0.4,
    WasteType.METAL: 0.3,
    WasteType.GLASS: 0.3,
    WasteType.OTHER: 0.6,       # Could contain hazardous items
}

# Reference depot location (center of Ahmedabad AMC area)
DEPOT_LAT = 23.0225
DEPOT_LNG = 72.5714


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


def compute_priorities(db: Session) -> list[dict]:
    """Compute and return all bins ranked by priority score."""
    bins = db.query(Bin).all()
    if not bins:
        return []

    # Compute max distance for normalization
    distances = []
    for b in bins:
        d = haversine_km(b.lat, b.lng, DEPOT_LAT, DEPOT_LNG)
        distances.append(d)
    max_dist = max(distances) if distances else 1.0
    if max_dist == 0:
        max_dist = 1.0

    scored = []
    for i, b in enumerate(bins):
        fill_norm = (b.current_fill_percent or 0.0) / 100.0

        # Urgency from overflow prediction
        try:
            prediction = predict_overflow(db, b)
            hours_to_overflow = prediction.get("hours_until_overflow")
            if hours_to_overflow is not None and hours_to_overflow > 0:
                urgency = 1.0 / max(hours_to_overflow, 1.0)
            else:
                urgency = 1.0 if fill_norm > 0.8 else 0.0
        except Exception:
            urgency = fill_norm  # fallback

        # Normalize urgency to 0-1 (cap at 1)
        urgency = min(urgency, 1.0)

        # Distance penalty: closer bins are slightly easier to reach (inverted)
        dist_norm = distances[i] / max_dist
        distance_penalty = 1.0 - dist_norm  # Closer = higher priority

        # Waste type weight
        wt = b.waste_type if isinstance(b.waste_type, WasteType) else WasteType(b.waste_type)
        waste_weight = WASTE_TYPE_WEIGHTS.get(wt, 0.5)

        priority_score = (
            0.45 * fill_norm
            + 0.30 * urgency
            + 0.15 * distance_penalty
            + 0.10 * waste_weight
        )

        scored.append({
            "bin_id": b.id,
            "bin_name": b.name,
            "zone": b.zone,
            "waste_type": wt.value,
            "current_fill_percent": round(b.current_fill_percent or 0, 2),
            "priority_score": round(priority_score, 4),
            "fill_component": round(0.45 * fill_norm, 4),
            "urgency_component": round(0.30 * urgency, 4),
            "distance_component": round(0.15 * distance_penalty, 4),
            "waste_type_component": round(0.10 * waste_weight, 4),
            "lat": b.lat,
            "lng": b.lng,
        })

    scored.sort(key=lambda x: x["priority_score"], reverse=True)
    return scored
