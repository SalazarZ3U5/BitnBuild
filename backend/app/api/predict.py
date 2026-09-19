"""
Fill-level prediction API.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Bin
from app.ml.fill_predictor import predict_overflow, predict_fill_at

router = APIRouter(tags=["predict"])


@router.get("/predict/{bin_id}")
def predict_bin_overflow(bin_id: int, db: Session = Depends(get_db)):
    """Predict when a bin will overflow based on its fill reading history."""
    bin_obj = db.query(Bin).filter(Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")

    result = predict_overflow(db, bin_obj)
    return result


@router.get("/predict/bulk/all")
def predict_bulk_fill(
    hours_ahead: float = Query(default=12.0, ge=0, le=168, description="Hours into the future to predict fill level"),
    db: Session = Depends(get_db),
):
    """
    Predict fill levels for ALL bins at a given number of hours from now.
    Used by the heatmap time-travel slider.
    
    Returns list of predictions with lat/lng/predicted_fill_percent for heatmap rendering.
    """
    bins = db.query(Bin).all()
    results = []
    for b in bins:
        try:
            pred = predict_fill_at(db, b, hours_ahead)
            results.append(pred)
        except Exception as e:
            # Fallback for bins with insufficient history
            results.append({
                "bin_id": b.id,
                "lat": b.lat,
                "lng": b.lng,
                "bin_name": b.name,
                "zone": b.zone,
                "waste_type": b.waste_type.value if hasattr(b.waste_type, 'value') else b.waste_type,
                "hours_ahead": hours_ahead,
                "current_fill_percent": b.current_fill_percent or 0.0,
                "predicted_fill_percent": min(100.0, (b.current_fill_percent or 0.0) + hours_ahead * 1.5),
                "hours_until_overflow": None,
                "predicted_overflow_at": None,
                "will_overflow_before": False,
                "collection_urgency": "ok",
            })
    
    # Summary stats
    immediate = sum(1 for r in results if r["collection_urgency"] == "immediate")
    soon = sum(1 for r in results if r["collection_urgency"] == "soon")
    scheduled = sum(1 for r in results if r["collection_urgency"] == "scheduled")
    will_overflow = sum(1 for r in results if r.get("will_overflow_before", False))
    
    return {
        "hours_ahead": hours_ahead,
        "total_bins": len(results),
        "overflow_within_window": will_overflow,
        "urgency_summary": {
            "immediate": immediate,
            "soon": soon,
            "scheduled": scheduled,
            "ok": len(results) - immediate - soon - scheduled,
        },
        "predictions": results,
    }
