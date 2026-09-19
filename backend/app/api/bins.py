"""Bins API router — CRUD for bins and fill readings."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional
import datetime

from app.db import get_db
from app.models import Bin, FillReading, WasteType

router = APIRouter(prefix="/bins", tags=["bins"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class BinCreate(BaseModel):
    name: str
    lat: float
    lng: float
    capacity_liters: float = 240.0
    waste_type: str = "Other"
    zone: str = "A"


class BinOut(BaseModel):
    id: int
    name: str
    lat: float
    lng: float
    capacity_liters: float
    waste_type: str
    zone: str
    current_fill_percent: float

    class Config:
        from_attributes = True


class ReadingCreate(BaseModel):
    fill_percent: float


class ReadingOut(BaseModel):
    id: int
    bin_id: int
    timestamp: datetime.datetime
    fill_percent: float

    class Config:
        from_attributes = True


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("", response_model=BinOut, status_code=201)
def create_bin(payload: BinCreate, db: Session = Depends(get_db)):
    bin_obj = Bin(
        name=payload.name,
        lat=payload.lat,
        lng=payload.lng,
        capacity_liters=payload.capacity_liters,
        waste_type=WasteType(payload.waste_type),
        zone=payload.zone,
    )
    db.add(bin_obj)
    db.commit()
    db.refresh(bin_obj)
    return bin_obj


@router.get("", response_model=list[BinOut])
def list_bins(db: Session = Depends(get_db)):
    return db.query(Bin).all()


@router.get("/{bin_id}", response_model=BinOut)
def get_bin(bin_id: int, db: Session = Depends(get_db)):
    bin_obj = db.query(Bin).filter(Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")
    return bin_obj


@router.post("/{bin_id}/readings", response_model=ReadingOut, status_code=201)
def add_reading(bin_id: int, payload: ReadingCreate, db: Session = Depends(get_db)):
    bin_obj = db.query(Bin).filter(Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")

    reading = FillReading(
        bin_id=bin_id,
        fill_percent=payload.fill_percent,
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(reading)

    # Update current fill
    bin_obj.current_fill_percent = payload.fill_percent
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/{bin_id}/readings", response_model=list[ReadingOut])
def list_readings(
    bin_id: int,
    limit: int = 500,
    db: Session = Depends(get_db),
):
    bin_obj = db.query(Bin).filter(Bin.id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")

    readings = (
        db.query(FillReading)
        .filter(FillReading.bin_id == bin_id)
        .order_by(desc(FillReading.timestamp))
        .limit(limit)
        .all()
    )
    return readings
