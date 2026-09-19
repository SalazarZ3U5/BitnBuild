"""
Route optimization API.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.ml.route_optimizer import optimize_routes, optimize_routes_predictive

router = APIRouter(tags=["routes"])


@router.get("/routes/today")
def get_today_routes(
    fill_threshold: float = Query(50.0, description="Minimum fill % to include a bin"),
    db: Session = Depends(get_db),
):
    """
    Generate optimized collection routes for today.
    Only bins above the fill threshold are included.
    Returns per-vehicle ordered stop lists and total distance.
    """
    return optimize_routes(db, fill_threshold=fill_threshold)


@router.get("/routes/predictive")
def get_predictive_routes(
    dispatch_at_hours: float = Query(default=12.0, ge=0, le=72, description="Hours from now to plan route for"),
    db: Session = Depends(get_db),
):
    """
    Generate optimized routes based on PREDICTED bin fill levels at dispatch_at_hours from now.
    Uses Prophet/linear regression to estimate each bin's fill level at that future time,
    then runs the CVRP optimizer with those predicted demands.
    
    This allows pre-planning collection trips before bins actually overflow.
    """
    return optimize_routes_predictive(db, dispatch_at_hours=dispatch_at_hours)
