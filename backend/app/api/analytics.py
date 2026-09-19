"""
Analytics API — hotspot patterns and waste totals.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
import datetime

from app.db import get_db
from app.models import Bin, FillReading, WasteType
from sqlalchemy import func
import numpy as np

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/patterns")
def get_patterns(db: Session = Depends(get_db)):
    """
    K-Means clustering on (lat, lng, avg_daily_fill_rate) to identify
    high-generation hotspot zones. Returns per-zone stats and collection
    frequency recommendations.
    """
    from sklearn.cluster import KMeans

    bins = db.query(Bin).all()
    if not bins:
        return {"clusters": [], "message": "No bins found"}

    # Compute avg daily fill rate per bin from readings
    bin_data = []
    for b in bins:
        readings = (
            db.query(FillReading)
            .filter(FillReading.bin_id == b.id)
            .order_by(FillReading.timestamp)
            .all()
        )
        if len(readings) < 2:
            avg_daily_rate = 0.0
        else:
            total_days = (readings[-1].timestamp - readings[0].timestamp).total_seconds() / 86400
            if total_days < 1:
                total_days = 1
            # Sum positive increments (fills), ignoring resets (collections)
            total_fill = 0.0
            for i in range(1, len(readings)):
                diff = readings[i].fill_percent - readings[i - 1].fill_percent
                if diff > 0:
                    total_fill += diff
            avg_daily_rate = total_fill / total_days

        bin_data.append({
            "bin_id": b.id,
            "name": b.name,
            "lat": b.lat,
            "lng": b.lng,
            "zone": b.zone,
            "waste_type": b.waste_type.value if isinstance(b.waste_type, WasteType) else b.waste_type,
            "avg_daily_fill_rate": round(avg_daily_rate, 2),
        })

    if len(bin_data) < 3:
        return {"clusters": [], "bins": bin_data, "message": "Too few bins for clustering"}

    # Prepare feature matrix
    X = np.array([[d["lat"], d["lng"], d["avg_daily_fill_rate"] / 100.0] for d in bin_data])

    n_clusters = min(5, len(bin_data))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)

    # Build cluster summaries
    clusters = {}
    for i, label in enumerate(labels):
        label = int(label)
        if label not in clusters:
            clusters[label] = {
                "cluster_id": label,
                "bins": [],
                "total_fill_rate": 0.0,
                "center_lat": 0.0,
                "center_lng": 0.0,
            }
        clusters[label]["bins"].append(bin_data[i])
        clusters[label]["total_fill_rate"] += bin_data[i]["avg_daily_fill_rate"]

    result = []
    for label, cluster in clusters.items():
        n = len(cluster["bins"])
        avg_rate = round(cluster["total_fill_rate"] / n, 2)
        center_lat = round(sum(b["lat"] for b in cluster["bins"]) / n, 6)
        center_lng = round(sum(b["lng"] for b in cluster["bins"]) / n, 6)

        # Collection frequency recommendation
        if avg_rate > 0:
            days_to_full = round(100 / avg_rate, 1)
            recommend = f"Fills ~{avg_rate}%/day → recommend collection every {max(1, int(days_to_full * 0.8))} days"
        else:
            days_to_full = None
            recommend = "Insufficient data for recommendation"

        result.append({
            "cluster_id": label,
            "num_bins": n,
            "center_lat": center_lat,
            "center_lng": center_lng,
            "avg_daily_fill_rate": avg_rate,
            "days_to_full": days_to_full,
            "recommendation": recommend,
            "bin_ids": [b["bin_id"] for b in cluster["bins"]],
        })

    # Sort by fill rate descending (hottest first)
    result.sort(key=lambda c: c["avg_daily_fill_rate"], reverse=True)
    return {"clusters": result, "bin_details": bin_data}


@router.get("/hotspots")
def get_hotspots(top_n: int = 8, db: Session = Depends(get_db)):
    """
    Returns the top N bins ranked by average daily fill rate.
    Each entry includes heat tier classification for frontend marker rendering.
    """
    bins = db.query(Bin).all()
    if not bins:
        return {"hotspots": []}

    bin_fill_rates = []
    for b in bins:
        readings = (
            db.query(FillReading)
            .filter(FillReading.bin_id == b.id)
            .order_by(FillReading.timestamp)
            .all()
        )
        if len(readings) < 2:
            avg_rate = b.current_fill_percent * 0.5 if b.current_fill_percent else 0.0
        else:
            total_days = (readings[-1].timestamp - readings[0].timestamp).total_seconds() / 86400
            if total_days < 1:
                total_days = 1
            total_fill = sum(
                readings[i].fill_percent - readings[i - 1].fill_percent
                for i in range(1, len(readings))
                if readings[i].fill_percent - readings[i - 1].fill_percent > 0
            )
            avg_rate = total_fill / total_days

        wt = b.waste_type.value if isinstance(b.waste_type, WasteType) else b.waste_type

        # Heat tier classification
        if avg_rate >= 35:
            tier = "critical"
        elif avg_rate >= 20:
            tier = "high"
        elif avg_rate >= 10:
            tier = "moderate"
        else:
            tier = "low"

        bin_fill_rates.append({
            "bin_id": b.id,
            "name": b.name,
            "lat": b.lat,
            "lng": b.lng,
            "zone": b.zone,
            "capacity_liters": b.capacity_liters,
            "waste_type": wt,
            "current_fill_percent": round(b.current_fill_percent or 0, 1),
            "avg_daily_fill_rate": round(avg_rate, 2),
            "heat_tier": tier,
            "is_top_producer": False,
            "special_alert": False,
        })

    # Sort descending by fill rate
    bin_fill_rates.sort(key=lambda x: x["avg_daily_fill_rate"], reverse=True)
    if bin_fill_rates:
        bin_fill_rates[0]["is_top_producer"] = True
        bin_fill_rates[0]["special_alert"] = True
    hotspots = bin_fill_rates[:top_n]

    return {
        "hotspots": hotspots,
        "total_bins_analyzed": len(bins),
    }


@router.get("/waste-totals")
def get_waste_totals(
    from_date: Optional[str] = Query(None, alias="from", description="Start date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, alias="to", description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Sum waste per category: capacity_liters * fill_percent_at_collection
    across all recorded collections in the date range.
    Enriched with:
    - 14-day daily collection timeline (recyclable vs residual)
    - 24-hour diurnal influx profile (Ahmedabad hourly generation curve)
    - 5-zone multi-dimensional radar comparison metrics
    - Real-world ecological impact indicators (CO2e, trees, kWh bio-energy)
    """
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    if from_date:
        start = datetime.datetime.strptime(from_date, "%Y-%m-%d")
    else:
        start = now - datetime.timedelta(days=30)

    if to_date:
        end = datetime.datetime.strptime(to_date, "%Y-%m-%d") + datetime.timedelta(days=1)
    else:
        end = now

    bins = db.query(Bin).all()
    bins_by_id = {b.id: b for b in bins}
    recyclable_types = {"Plastic", "Paper", "Metal", "Glass"}
    category_totals = {}

    # Daily aggregation dictionary: date_str -> {'recyclable': 0.0, 'residual': 0.0}
    from collections import defaultdict
    daily_buckets = defaultdict(lambda: {"recyclable": 0.0, "residual": 0.0})

    for b in bins:
        wt = b.waste_type.value if isinstance(b.waste_type, WasteType) else str(b.waste_type)
        is_rec = wt in recyclable_types

        # Get readings in range where fill drops (collection events)
        readings = (
            db.query(FillReading)
            .filter(
                FillReading.bin_id == b.id,
                FillReading.timestamp >= start,
                FillReading.timestamp <= end,
            )
            .order_by(FillReading.timestamp)
            .all()
        )

        collected_liters = 0.0
        cap = float(b.capacity_liters or 240.0)
        for i in range(1, len(readings)):
            diff = readings[i].fill_percent - readings[i - 1].fill_percent
            if diff < -25.0:  # Collection event
                collected_amount = (readings[i - 1].fill_percent / 100.0) * cap
                collected_liters += collected_amount
                
                # Tag to daily bucket
                day_key = readings[i].timestamp.strftime("%Y-%m-%d")
                if is_rec:
                    daily_buckets[day_key]["recyclable"] += collected_amount
                else:
                    daily_buckets[day_key]["residual"] += collected_amount

        if wt not in category_totals:
            category_totals[wt] = 0.0
        category_totals[wt] += round(collected_liters, 2)

    recyclable = sum(v for k, v in category_totals.items() if k in recyclable_types)
    non_recyclable = sum(v for k, v in category_totals.items() if k not in recyclable_types)
    total_vol = recyclable + non_recyclable

    # Format 14-day daily timeline sorted chronologically
    timeline_days = []
    for i in range(13, -1, -1):
        day_date = now - datetime.timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        display_str = day_date.strftime("%b %d")
        rec_val = round(daily_buckets[day_str]["recyclable"], 1)
        res_val = round(daily_buckets[day_str]["residual"], 1)
        day_total = round(rec_val + res_val, 1)
        div_pct = round((rec_val / max(1.0, day_total)) * 100.0, 1)
        timeline_days.append({
            "date": display_str,
            "full_date": day_str,
            "recyclable_liters": rec_val,
            "residual_liters": res_val,
            "total_liters": day_total,
            "diversion_rate": div_pct,
        })

    # 24-Hour Diurnal Waste Influx Curve (Ahmedabad Municipal Circadian Profile)
    # Calibrated to total citywide hourly generation rate
    from app.ml.fill_predictor import HOURLY_DIURNAL_WEIGHTS
    city_hourly_base_liters = (total_vol / max(1, 30 * 24))  # Average liters per hour
    hourly_influx = []
    for h in range(24):
        weight = HOURLY_DIURNAL_WEIGHTS[h]
        liters_this_hour = round(city_hourly_base_liters * weight, 1)
        rate_pct = round(weight * 1.5, 2)
        if 0 <= h <= 5:
            phase = "Night Lull"
        elif 6 <= h <= 11:
            phase = "Morning Market Rush"
        elif 12 <= h <= 16:
            phase = "Afternoon Plateau"
        elif 17 <= h <= 21:
            phase = "Evening Bazaar Peak"
        else:
            phase = "Night Transition"

        hourly_influx.append({
            "hour": f"{h:02d}:00",
            "hour_num": h,
            "influx_liters": liters_this_hour,
            "velocity_pct": rate_pct,
            "phase": phase,
            "weight": weight,
        })

    # Multi-Zone Spatial Radar Metrics
    zone_groups = defaultdict(lambda: {"bins": [], "total_fill": 0.0, "rec_bins": 0, "crit_bins": 0})
    for b in bins:
        z = b.zone or "Other"
        zone_groups[z]["bins"].append(b)
        zone_groups[z]["total_fill"] += float(b.current_fill_percent or 0.0)
        if (b.current_fill_percent or 0) >= 80.0:
            zone_groups[z]["crit_bins"] += 1
        b_wt = b.waste_type.value if hasattr(b.waste_type, "value") else str(b.waste_type)
        if b_wt in recyclable_types:
            zone_groups[z]["rec_bins"] += 1

    zone_radar = []
    for z, data in zone_groups.items():
        n = max(1, len(data["bins"]))
        short = (
            z.replace(" Zone", "")
            .replace(" (Navrangpura)", "")
            .replace(" (Bodakdev)", "")
            .replace(" (Khadia/Riverfront)", "")
            .replace(" (Satellite)", "")
            .replace(" (Bapunagar/Nikol)", "")
        )
        avg_f = round(data["total_fill"] / n, 1)
        rec_pct = round((data["rec_bins"] / n) * 100.0, 1)
        zone_radar.append({
            "zone": z,
            "short_name": short,
            "avg_fill": avg_f,
            "recyclability": rec_pct,
            "critical_bins": data["crit_bins"],
            "bins_count": n,
        })

    # Ecological Impact Indicators
    # Plastic: ~0.8 kg/liter -> 1 ton plastic saves 1.5 ton CO2e
    # Paper: ~0.4 kg/liter -> 1 ton paper saves 17 trees, 26,000L water
    # Organic: ~0.7 kg/liter -> 1 ton wet biomethanation yields 85 kWh
    plastic_l = category_totals.get("Plastic", 0.0)
    paper_l = category_totals.get("Paper", 0.0)
    organic_l = category_totals.get("Organic", 0.0)
    metal_l = category_totals.get("Metal", 0.0)

    co2_saved = round((plastic_l * 0.0008 * 1.5) + (paper_l * 0.0004 * 1.0) + (metal_l * 0.001 * 4.0), 1)
    trees_saved = max(1, int(paper_l * 0.0004 * 17))
    energy_kwh = round(organic_l * 0.0007 * 85, 1)
    landfill_m3 = round(total_vol / 1000.0, 1)

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "by_category": category_totals,
        "recyclable_liters": round(recyclable, 2),
        "non_recyclable_liters": round(non_recyclable, 2),
        "total_liters": round(total_vol, 2),
        "diversion_rate": round((recyclable / max(1.0, total_vol)) * 100.0, 1),
        "daily_timeline": timeline_days,
        "hourly_influx": hourly_influx,
        "zone_radar": zone_radar,
        "ecological_impact": {
            "co2_saved_tons": co2_saved,
            "trees_saved": trees_saved,
            "energy_generated_kwh": energy_kwh,
            "landfill_space_m3": landfill_m3,
        },
    }

