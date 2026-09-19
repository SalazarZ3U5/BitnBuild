"""
Route optimization API.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.ml.route_optimizer import optimize_routes

router = APIRouter(tags=["routes"])


@router.get("/routes/today")
def get_today_routes(
    fill_threshold: float = Query(60.0, description="Minimum fill % to include a bin"),
    db: Session = Depends(get_db),
):
    """
    Generate optimized collection routes for today.
    Only bins above the fill threshold are included.
    Returns per-vehicle ordered stop lists and total distance.
    """
    return optimize_routes(db, fill_threshold=fill_threshold)
