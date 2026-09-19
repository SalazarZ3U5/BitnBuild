"""
Alerts API router.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
import datetime

from app.db import get_db
from app.models import Alert
from app.ml.anomaly_detector import run_anomaly_detection

router = APIRouter(tags=["alerts"])


class AlertOut(BaseModel):
    id: int
    bin_id: Optional[int] = None
    zone: Optional[str] = None
    alert_type: str
    message: str
    severity: str
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(active_only: bool = True, db: Session = Depends(get_db)):
    """List all alerts, optionally filtered to active only."""
    query = db.query(Alert)
    if active_only:
        query = query.filter(Alert.is_active == True)
    return query.order_by(desc(Alert.created_at)).all()


@router.post("/alerts/detect")
def trigger_anomaly_detection(db: Session = Depends(get_db)):
    """Run anomaly detection and threshold checks, creating new alerts."""
    new_alerts = run_anomaly_detection(db)
    return {"new_alerts": len(new_alerts), "alerts": new_alerts}


@router.patch("/alerts/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    """Mark an individual alert as resolved."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = False
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/resolve-all")
def resolve_all_alerts(db: Session = Depends(get_db)):
    """Mark all currently active alerts as resolved."""
    updated_count = db.query(Alert).filter(Alert.is_active == True).update({Alert.is_active: False})
    db.commit()
    return {"resolved_count": updated_count, "status": "ok"}

