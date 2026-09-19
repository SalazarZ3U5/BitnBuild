"""
Simulation and Telemetry Replay Router — AMC WasteOptimizer.
Enables real-time streaming and replay of IoT sensor telemetry,
progressive fill evolution, and edge-case anomaly injection.
"""

import os
import json
import asyncio
import random
import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db, SessionLocal
from app.models import Bin, FillReading, Alert, Route, RouteStop

router = APIRouter(prefix="/simulation", tags=["simulation"])

# State variables for simulation playback
_sim_task: Optional[asyncio.Task] = None
_sim_running: bool = False
_sim_interval_seconds: float = 3.0
_sim_step_count: int = 0
_broadcast_callback = None

# Path to telemetry dataset
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
TELEMETRY_JSON = PROJECT_ROOT / "test_dataset" / "telemetry" / "amc_bins_test_telemetry.json"
ANOMALY_JSON = PROJECT_ROOT / "test_dataset" / "telemetry" / "anomaly_scenarios.json"


def set_broadcast_callback(cb):
    """Sets the WebSocket broadcast function from main.py."""
    global _broadcast_callback
    _broadcast_callback = cb


class AnomalyPayload(BaseModel):
    scenario_id: str


class TogglePayload(BaseModel):
    enabled: bool
    interval_seconds: Optional[float] = 3.0


async def _run_sim_loop():
    """Background loop that steps telemetry forward periodically."""
    global _sim_running, _sim_step_count
    while _sim_running:
        await asyncio.sleep(_sim_interval_seconds)
        if not _sim_running:
            break
        await perform_simulation_step()


async def perform_simulation_step():
    """Advances telemetry by one time step and updates all bins."""
    global _sim_step_count, _sim_running, _sim_task
    _sim_step_count += 1
    
    db = SessionLocal()
    try:
        bins = db.query(Bin).all()
        now = datetime.datetime.now(datetime.timezone.utc)
        new_alerts = []

        for b in bins:
            # Dynamic simulation rise: between 5.0% and 11.0% per step
            # Ensures green pins visibly turn to amber (>50%) and RED (>80%) rapidly
            delta = random.uniform(5.0, 11.0)
            new_fill = min(100.0, b.current_fill_percent + delta)
            b.current_fill_percent = round(new_fill, 1)

            # Record fill reading
            db.add(FillReading(
                bin_id=b.id,
                timestamp=now,
                fill_percent=b.current_fill_percent,
            ))

            # Threshold alerts
            if b.current_fill_percent >= 80.0:
                existing = db.query(Alert).filter(
                    Alert.bin_id == b.id,
                    Alert.is_active == True,
                    Alert.severity == "critical"
                ).first()
                if not existing:
                    alert = Alert(
                        bin_id=b.id,
                        zone=b.zone,
                        alert_type="threshold",
                        message=f"{b.name} overflow warning ({b.current_fill_percent:.0f}%) — AMC dispatch required!",
                        severity="critical",
                        is_active=True,
                    )
                    db.add(alert)
                    new_alerts.append(alert)

            elif b.current_fill_percent >= 50.0:
                existing = db.query(Alert).filter(
                    Alert.bin_id == b.id,
                    Alert.is_active == True,
                ).first()
                if not existing:
                    alert = Alert(
                        bin_id=b.id,
                        zone=b.zone,
                        alert_type="threshold",
                        message=f"{b.name} nearing capacity ({b.current_fill_percent:.0f}%).",
                        severity="warning",
                        is_active=True,
                    )
                    db.add(alert)
                    new_alerts.append(alert)

        # Check if all bins hit critical capacity (>=80%)
        critical_count = sum(1 for b in bins if b.current_fill_percent >= 80.0)
        total_count = len(bins)
        all_critical = (critical_count == total_count) and total_count > 0

        # When all bins hit critical, automatically pause simulation
        if all_critical and _sim_running:
            _sim_running = False
            if _sim_task:
                _sim_task.cancel()
                _sim_task = None
            print(f"[Simulation] All {total_count} bins reached critical capacity. Simulation auto-paused.")

        db.commit()

        # Trigger WebSocket broadcast if callback configured
        if _broadcast_callback:
            await _broadcast_callback()

    except Exception as e:
        print(f"[Simulation] Error during step: {e}")
        db.rollback()
    finally:
        db.close()


@router.get("/status")
def get_simulation_status(db: Session = Depends(get_db)):
    """Returns current live simulation state including critical ratio."""
    bins = db.query(Bin).all()
    total_count = len(bins)
    critical_count = sum(1 for b in bins if b.current_fill_percent >= 80.0)
    all_critical = (critical_count == total_count) and total_count > 0

    return {
        "is_running": _sim_running,
        "step_count": _sim_step_count,
        "interval_seconds": _sim_interval_seconds,
        "mode": "AMC Live Sensor Replay",
        "critical_count": critical_count,
        "total_bins": total_count,
        "all_critical": all_critical,
    }


@router.post("/toggle")
async def toggle_simulation(payload: TogglePayload):
    """Starts or stops automated background telemetry playback."""
    global _sim_running, _sim_task, _sim_interval_seconds
    _sim_interval_seconds = payload.interval_seconds or 3.0

    if payload.enabled and not _sim_running:
        _sim_running = True
        _sim_task = asyncio.create_task(_run_sim_loop())
        return {"status": "started", "interval_seconds": _sim_interval_seconds}
    elif not payload.enabled and _sim_running:
        _sim_running = False
        if _sim_task:
            _sim_task.cancel()
            _sim_task = None
        return {"status": "stopped"}

    return {"status": "unchanged", "is_running": _sim_running}


@router.post("/tick")
async def manual_tick():
    """Triggers a single simulated time step immediately."""
    await perform_simulation_step()
    return {"status": "tick_completed", "step_count": _sim_step_count}


@router.post("/fill-all-critical")
async def fill_all_critical(db: Session = Depends(get_db)):
    """Surges all 40 bins to critical level (86–98%) immediately and auto-pauses simulation."""
    global _sim_running, _sim_task
    _sim_running = False
    if _sim_task:
        _sim_task.cancel()
        _sim_task = None

    bins = db.query(Bin).all()
    now = datetime.datetime.now(datetime.timezone.utc)
    for b in bins:
        b.current_fill_percent = round(random.uniform(86.0, 97.5), 1)
        db.add(FillReading(bin_id=b.id, timestamp=now, fill_percent=b.current_fill_percent))

        existing = db.query(Alert).filter(
            Alert.bin_id == b.id,
            Alert.is_active == True,
            Alert.severity == "critical"
        ).first()
        if not existing:
            db.add(Alert(
                bin_id=b.id,
                zone=b.zone,
                alert_type="threshold",
                message=f"CRITICAL OVERFLOW: {b.name} surged to {b.current_fill_percent:.0f}% capacity!",
                severity="critical",
                is_active=True,
            ))

    db.commit()
    if _broadcast_callback:
        await _broadcast_callback()

    return {
        "status": "all_critical",
        "message": f"All {len(bins)} AMC bins surged to critical (>80%). Simulation auto-paused.",
        "all_critical": True
    }


@router.post("/inject-anomaly")
async def inject_anomaly(payload: AnomalyPayload, db: Session = Depends(get_db)):
    """Injects a specific telemetry anomaly scenario (e.g. Manek Chowk rapid spike)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    scenario_id = payload.scenario_id

    if scenario_id == "SCENARIO_RAPID_SPIKE":
        # Target Manek Chowk or first bin
        target = db.query(Bin).filter(Bin.name.like("%Manek Chowk%")).first()
        if not target:
            target = db.query(Bin).first()

        target.current_fill_percent = 94.5
        db.add(FillReading(
            bin_id=target.id,
            timestamp=now,
            fill_percent=94.5,
        ))
        alert = Alert(
            bin_id=target.id,
            zone=target.zone,
            alert_type="anomaly_spike",
            message=f"🚨 CRITICAL SPIKE: {target.name} surged to 94.5% during peak commercial activity!",
            severity="critical",
            is_active=True,
        )
        db.add(alert)
        db.commit()

        if _broadcast_callback:
            await _broadcast_callback()

        return {
            "status": "injected",
            "scenario": scenario_id,
            "target_bin": target.name,
            "fill_percent": target.current_fill_percent,
            "alert": alert.message
        }

    elif scenario_id == "SCENARIO_HIGH_TILT_VANDALISM":
        target = db.query(Bin).filter(Bin.name.like("%Riverfront%")).first()
        if not target:
            target = db.query(Bin).offset(1).first()

        alert = Alert(
            bin_id=target.id,
            zone=target.zone,
            alert_type="physical_tilt",
            message=f"⚠️ TILT ALERT: {target.name} tilt sensor triggered at 47.5° (potential tip-over).",
            severity="warning",
            is_active=True,
        )
        db.add(alert)
        db.commit()

        if _broadcast_callback:
            await _broadcast_callback()

        return {
            "status": "injected",
            "scenario": scenario_id,
            "target_bin": target.name,
            "alert": alert.message
        }

    elif scenario_id == "SCENARIO_THERMAL_ANOMALY":
        target = db.query(Bin).filter(Bin.name.like("%Law Garden%")).first()
        if not target:
            target = db.query(Bin).offset(2).first()

        alert = Alert(
            bin_id=target.id,
            zone=target.zone,
            alert_type="thermal_warning",
            message=f"🔥 THERMAL RISK: {target.name} internal sensor logged 64.2°C (smoldering risk).",
            severity="critical",
            is_active=True,
        )
        db.add(alert)
        db.commit()

        if _broadcast_callback:
            await _broadcast_callback()

        return {
            "status": "injected",
            "scenario": scenario_id,
            "target_bin": target.name,
            "alert": alert.message
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unknown scenario ID: {scenario_id}")


class EmptyBinsPayload(BaseModel):
    bin_names: list[str]


@router.post("/empty-bins")
async def empty_bins(payload: EmptyBinsPayload, db: Session = Depends(get_db)):
    """
    Empties collected bins down to clean residual fill levels (4-7%, green)
    and resolves critical alerts for those bins.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    updated = []
    for name in payload.bin_names:
        bin_obj = db.query(Bin).filter(Bin.name == name).first()
        if bin_obj:
            bin_obj.current_fill_percent = round(random.uniform(4.0, 7.0), 1)
            db.add(FillReading(
                bin_id=bin_obj.id,
                timestamp=now,
                fill_percent=bin_obj.current_fill_percent,
            ))
            # Deactivate active alerts for this serviced bin
            db.query(Alert).filter(Alert.bin_id == bin_obj.id, Alert.is_active == True).update({"is_active": False})
            updated.append(bin_obj.name)

    db.commit()

    if _broadcast_callback and updated:
        await _broadcast_callback()

    return {
        "status": "success",
        "emptied_count": len(updated),
        "emptied_bins": updated,
    }


@router.post("/reset")
async def reset_simulation(db: Session = Depends(get_db)):
    """
    Resets all bins to safe, nominal operational levels (15-35% fill, all green),
    clears step counter to 0, deletes old routes, and resolves all active alerts.
    Allows re-running the entire simulation from scratch.
    """
    global _sim_running, _sim_task, _sim_step_count
    _sim_running = False
    _sim_step_count = 0
    if _sim_task:
        _sim_task.cancel()
        _sim_task = None

    now = datetime.datetime.now(datetime.timezone.utc)
    bins = db.query(Bin).all()
    for b in bins:
        b.current_fill_percent = round(random.uniform(18.0, 38.0), 1)
        db.add(FillReading(
            bin_id=b.id,
            timestamp=now,
            fill_percent=b.current_fill_percent,
        ))

    # Deactivate active alerts
    db.query(Alert).filter(Alert.is_active == True).update({"is_active": False})

    # Clear today's routes and stops
    try:
        db.query(RouteStop).delete()
        db.query(Route).delete()
    except Exception as e:
        print(f"[Simulation] Route cleanup error: {e}")

    db.commit()

    if _broadcast_callback:
        await _broadcast_callback()

    return {
        "status": "reset_completed",
        "step_count": 0,
        "message": "All 40 AMC bins restored to nominal baseline (18-38% fill). Alerts cleared, routes reset. Ready to re-run.",
        "all_critical": False,
    }

