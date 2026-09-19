"""
AI-powered recycling suggestions API.
Generates actionable, zone-level recycling and collection recommendations
derived from real bin fill data and waste type distributions.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict

from app.db import get_db
from app.models import Bin, WasteType

router = APIRouter(prefix="/recycling", tags=["recycling"])

RECYCLABLE_TYPES = {"Plastic", "Paper", "Metal", "Glass"}

def _get_zone_stats(db: Session) -> dict:
    """Aggregate bin data by zone."""
    bins = db.query(Bin).all()
    zones = defaultdict(lambda: {
        "bins": [],
        "waste_types": defaultdict(int),
        "total_fill": 0.0,
        "bin_count": 0,
    })
    for b in bins:
        wt = b.waste_type.value if isinstance(b.waste_type, WasteType) else b.waste_type
        z = zones[b.zone]
        z["bins"].append(b)
        z["waste_types"][wt] += 1
        z["total_fill"] += (b.current_fill_percent or 0)
        z["bin_count"] += 1
    return zones


@router.get("/suggestions")
def get_recycling_suggestions(db: Session = Depends(get_db)):
    """
    Returns zone-level AI recycling recommendations based on:
    - Waste type distribution per zone
    - Current fill levels
    - Recyclability ratios
    Each suggestion has a priority, type, zone, action text, and impact estimate.
    """
    zones = _get_zone_stats(db)
    if not zones:
        return {"suggestions": [], "summary": {}}

    suggestions = []
    all_bins = db.query(Bin).all()

    # ── Global stats ────────────────────────────────────────────────────────
    total_bins = len(all_bins)
    critical_bins = [b for b in all_bins if (b.current_fill_percent or 0) >= 80]
    recyclable_bins = [
        b for b in all_bins
        if (b.waste_type.value if isinstance(b.waste_type, WasteType) else b.waste_type) in RECYCLABLE_TYPES
    ]
    recyclability_ratio = round(len(recyclable_bins) / total_bins * 100, 1) if total_bins else 0

    # ── Zone-level suggestions ───────────────────────────────────────────────
    zone_avg_fills = {}
    for zone, data in zones.items():
        avg_fill = data["total_fill"] / data["bin_count"] if data["bin_count"] > 0 else 0
        zone_avg_fills[zone] = avg_fill

    # Find hottest and coolest zones for comparison
    sorted_zones = sorted(zone_avg_fills.items(), key=lambda x: x[1], reverse=True)
    hottest_zone = sorted_zones[0][0] if sorted_zones else None
    coolest_zone = sorted_zones[-1][0] if len(sorted_zones) > 1 else None

    for zone, data in zones.items():
        avg_fill = zone_avg_fills[zone]
        bin_count = data["bin_count"]
        wt_counts = data["waste_types"]
        dominant_type = max(wt_counts, key=wt_counts.get) if wt_counts else "Mixed"
        dominant_pct = round(wt_counts[dominant_type] / bin_count * 100) if bin_count else 0

        # --- High fill → increase frequency ---
        if avg_fill >= 70:
            suggestions.append({
                "id": f"freq-{zone}",
                "priority": "high",
                "type": "collection_frequency",
                "zone": zone,
                "category": dominant_type,
                "icon": "🔴",
                "action": f"Increase collection frequency in Zone {zone} — avg fill at {avg_fill:.0f}%. Schedule daily pickups.",
                "impact_estimate": f"Prevents overflow for {bin_count} bins, reduces overflow risk by ~85%",
                "metric": f"{avg_fill:.0f}% avg fill",
            })
        elif avg_fill >= 50:
            suggestions.append({
                "id": f"freq-warn-{zone}",
                "priority": "medium",
                "type": "collection_frequency",
                "zone": zone,
                "category": dominant_type,
                "icon": "🟡",
                "action": f"Zone {zone} averaging {avg_fill:.0f}% fill. Increase to every-2-day schedule to stay ahead of overflow.",
                "impact_estimate": f"Reduces critical incidents by ~60% for {bin_count} bins",
                "metric": f"{avg_fill:.0f}% avg fill",
            })

        # --- Dominant recyclable type → sorting facility suggestion ---
        if dominant_type in RECYCLABLE_TYPES and dominant_pct >= 50:
            facility_map = {
                "Plastic": "PET compactor & MRF sorting line",
                "Paper": "cardboard baler facility",
                "Metal": "scrap metal aggregation depot",
                "Glass": "glass crushing & cullet facility",
            }
            suggestions.append({
                "id": f"sort-{zone}-{dominant_type}",
                "priority": "medium",
                "type": "sorting_infrastructure",
                "zone": zone,
                "category": dominant_type,
                "icon": "♻️",
                "action": f"Zone {zone} is {dominant_pct}% {dominant_type} waste. Route directly to {facility_map.get(dominant_type, 'recycling facility')} to maximize recovery.",
                "impact_estimate": f"Up to {dominant_pct}% of Zone {zone} waste can be diverted from landfill",
                "metric": f"{dominant_pct}% {dominant_type}",
            })

        # --- Low recyclable ratio in zone → education/bin type change ---
        zone_recyclable = sum(v for k, v in wt_counts.items() if k in RECYCLABLE_TYPES)
        zone_recyclability = round(zone_recyclable / bin_count * 100) if bin_count else 0
        if zone_recyclability < 30 and bin_count >= 3:
            suggestions.append({
                "id": f"recycle-low-{zone}",
                "priority": "low",
                "type": "infrastructure_upgrade",
                "zone": zone,
                "category": "Mixed",
                "icon": "🔵",
                "action": f"Zone {zone} has only {zone_recyclability}% recyclable-type bins. Consider adding dual-stream bins (recyclable + organic) to improve segregation.",
                "impact_estimate": "Dual-stream segregation typically improves recycling rate by 25–40%",
                "metric": f"{zone_recyclability}% recyclable",
            })

    # ── Cross-zone comparative insights ─────────────────────────────────────
    if hottest_zone and coolest_zone and hottest_zone != coolest_zone:
        hot_fill = zone_avg_fills[hottest_zone]
        cool_fill = zone_avg_fills[coolest_zone]
        if hot_fill > cool_fill * 2:
            suggestions.append({
                "id": "rebalance-zones",
                "priority": "medium",
                "type": "fleet_rebalancing",
                "zone": f"{hottest_zone} → {coolest_zone}",
                "category": "Fleet",
                "icon": "🚛",
                "action": f"Zone {hottest_zone} fills {hot_fill:.0f}% vs Zone {coolest_zone} at {cool_fill:.0f}%. Reallocate 1 truck from Zone {coolest_zone} to Zone {hottest_zone} route.",
                "impact_estimate": f"Reduces overflow events in Zone {hottest_zone} by ~40%",
                "metric": f"{hot_fill:.0f}% vs {cool_fill:.0f}%",
            })

    # ── Global recycling efficiency suggestion ───────────────────────────────
    if recyclability_ratio < 50:
        suggestions.append({
            "id": "global-recyclability",
            "priority": "low",
            "type": "policy",
            "zone": "All Zones",
            "category": "Mixed",
            "icon": "📋",
            "action": f"Only {recyclability_ratio}% of AMC bins are designated recyclable-type. Expand recycling bin coverage across high-density zones.",
            "impact_estimate": "Increasing recyclable bin share to 60% could divert ~800L/day from landfill",
            "metric": f"{recyclability_ratio}% recyclable bins",
        })
    else:
        suggestions.append({
            "id": "global-recyclability-good",
            "priority": "low",
            "type": "policy",
            "zone": "All Zones",
            "category": "Recyclable",
            "icon": "✅",
            "action": f"{recyclability_ratio}% recyclable bin coverage — strong segregation infrastructure. Focus on collection timing optimization.",
            "impact_estimate": "Maintain diversion rate; optimize route frequency for continued performance",
            "metric": f"{recyclability_ratio}% recyclable bins",
        })

    # Sort: high → medium → low
    priority_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda s: priority_order.get(s["priority"], 3))

    return {
        "suggestions": suggestions,
        "summary": {
            "total_bins": total_bins,
            "critical_bins": len(critical_bins),
            "recyclability_ratio": recyclability_ratio,
            "zones_analyzed": len(zones),
        },
    }
