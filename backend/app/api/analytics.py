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
    return {"clusters": result}


@router.get("/waste-totals")
def get_waste_totals(
    from_date: Optional[str] = Query(None, alias="from", description="Start date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, alias="to", description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """
    Sum waste per category: capacity_liters * fill_percent_at_collection
    across all recorded collections in the date range.
    Split into recyclable vs non-recyclable.
    """
    now = datetime.datetime.utcnow()
    if from_date:
        start = datetime.datetime.strptime(from_date, "%Y-%m-%d")
    else:
        start = now - datetime.timedelta(days=30)

    if to_date:
        end = datetime.datetime.strptime(to_date, "%Y-%m-%d") + datetime.timedelta(days=1)
    else:
        end = now

    bins = db.query(Bin).all()
    category_totals = {}
    for b in bins:
        wt = b.waste_type.value if isinstance(b.waste_type, WasteType) else b.waste_type

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
        for i in range(1, len(readings)):
            diff = readings[i].fill_percent - readings[i - 1].fill_percent
            if diff < -30:  # Likely a collection event
                collected_amount = readings[i - 1].fill_percent / 100.0 * b.capacity_liters
                collected_liters += collected_amount

        if wt not in category_totals:
            category_totals[wt] = 0.0
        category_totals[wt] += round(collected_liters, 2)

    recyclable_types = {"Plastic", "Paper", "Metal", "Glass"}
    recyclable = sum(v for k, v in category_totals.items() if k in recyclable_types)
    non_recyclable = sum(v for k, v in category_totals.items() if k not in recyclable_types)

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "by_category": category_totals,
        "recyclable_liters": round(recyclable, 2),
        "non_recyclable_liters": round(non_recyclable, 2),
        "total_liters": round(recyclable + non_recyclable, 2),
    }
