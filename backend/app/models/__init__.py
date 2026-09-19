import enum
import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Enum, ForeignKey, Boolean, Text
)
from sqlalchemy.orm import relationship
from app.db import Base


class WasteType(str, enum.Enum):
    PLASTIC = "Plastic"
    PAPER = "Paper"
    METAL = "Metal"
    GLASS = "Glass"
    ORGANIC = "Organic"
    OTHER = "Other"


class Bin(Base):
    __tablename__ = "bins"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity_liters = Column(Float, nullable=False, default=240.0)
    waste_type = Column(Enum(WasteType), nullable=False, default=WasteType.OTHER)
    zone = Column(String(50), nullable=False, default="A")
    current_fill_percent = Column(Float, default=0.0)
    last_collected = Column(DateTime, default=datetime.datetime.utcnow)

    readings = relationship("FillReading", back_populates="bin", cascade="all, delete-orphan")


class FillReading(Base):
    __tablename__ = "fill_readings"

    id = Column(Integer, primary_key=True, index=True)
    bin_id = Column(Integer, ForeignKey("bins.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
    fill_percent = Column(Float, nullable=False)

    bin = relationship("Bin", back_populates="readings")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    capacity_liters = Column(Float, nullable=False, default=5000.0)
    depot_lat = Column(Float, nullable=False)
    depot_lng = Column(Float, nullable=False)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    date = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    total_distance_km = Column(Float, default=0.0)
    status = Column(String(20), default="planned")

    vehicle = relationship("Vehicle")
    stops = relationship("RouteStop", back_populates="route", cascade="all, delete-orphan",
                         order_by="RouteStop.stop_order")


class RouteStop(Base):
    __tablename__ = "route_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    bin_id = Column(Integer, ForeignKey("bins.id"), nullable=False)
    stop_order = Column(Integer, nullable=False)
    estimated_arrival = Column(DateTime, nullable=True)

    route = relationship("Route", back_populates="stops")
    bin = relationship("Bin")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    bin_id = Column(Integer, ForeignKey("bins.id"), nullable=True)
    zone = Column(String(50), nullable=True)
    alert_type = Column(String(50), nullable=False)  # "overflow", "anomaly", "threshold"
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="warning")  # "info", "warning", "critical"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    bin = relationship("Bin")
