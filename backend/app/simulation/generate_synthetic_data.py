"""
Synthetic data generator for the Waste Management Optimizer demo.
Creates ~40 bins across Bangalore, backfills 60 days of hourly fill readings,
creates 3 collection vehicles, and generates initial alerts.
"""
import random
import datetime
import math
from sqlalchemy.orm import Session
from app.models import Bin, FillReading, Vehicle, Alert, WasteType

# Bangalore city center area
CENTER_LAT = 12.9716
CENTER_LNG = 77.5946

# Zone definitions with approximate offsets from center
ZONES = {
    "Zone-A": {"lat_offset": 0.02, "lng_offset": -0.02, "bins": 8},
    "Zone-B": {"lat_offset": -0.01, "lng_offset": 0.03, "bins": 8},
    "Zone-C": {"lat_offset": 0.03, "lng_offset": 0.01, "bins": 8},
    "Zone-D": {"lat_offset": -0.03, "lng_offset": -0.01, "bins": 8},
    "Zone-E": {"lat_offset": 0.0, "lng_offset": 0.0, "bins": 8},
}

WASTE_TYPES = list(WasteType)

BIN_NAME_PREFIXES = [
    "Market", "Park", "School", "Hospital", "Mall", "Station",
    "Office", "Residential", "Community", "Temple", "Library",
    "Stadium", "Bus Stop", "Cinema", "Restaurant", "College",
    "Apartment", "Garden", "Playground", "Bridge"
]


def generate_bins(db: Session) -> list[Bin]:
    """Create ~40 bins across zones."""
    bins = []
    bin_counter = 1

    for zone_name, zone_info in ZONES.items():
        for i in range(zone_info["bins"]):
            # Random position within the zone
            lat = CENTER_LAT + zone_info["lat_offset"] + random.uniform(-0.015, 0.015)
            lng = CENTER_LNG + zone_info["lng_offset"] + random.uniform(-0.015, 0.015)
            capacity = random.choice([120, 240, 360, 480])
            waste_type = random.choice(WASTE_TYPES)
            prefix = random.choice(BIN_NAME_PREFIXES)

            bin_obj = Bin(
                name=f"{prefix} Bin {bin_counter}",
                lat=round(lat, 6),
                lng=round(lng, 6),
                capacity_liters=capacity,
                waste_type=waste_type,
                zone=zone_name,
                current_fill_percent=0.0,
            )
            db.add(bin_obj)
            bins.append(bin_obj)
            bin_counter += 1

    db.flush()
    return bins


def generate_fill_readings(db: Session, bins: list[Bin], days: int = 60):
    """
    Backfill hourly fill readings using a sawtooth pattern:
    Fill rises 2-8%/day with noise, resets to 0-10% at random collection events.
    """
    now = datetime.datetime.utcnow()
    start = now - datetime.timedelta(days=days)
    readings_batch = []

    for bin_obj in bins:
        fill = random.uniform(0, 10)  # Start fill
        daily_rate = random.uniform(2, 8)  # % per day rise
        hourly_rate = daily_rate / 24.0
        # Random collection interval (every 3-7 days)
        collection_interval_hours = random.randint(3, 7) * 24
        hours_since_collection = 0

        current_time = start
        while current_time <= now:
            # Add noise
            noise = random.gauss(0, 0.5)
            fill += hourly_rate + noise
            fill = max(0, min(fill, 100))
            hours_since_collection += 1

            # Collection event
            if hours_since_collection >= collection_interval_hours and fill > 50:
                fill = random.uniform(0, 10)
                hours_since_collection = 0
                collection_interval_hours = random.randint(3, 7) * 24

            readings_batch.append(FillReading(
                bin_id=bin_obj.id,
                timestamp=current_time,
                fill_percent=round(fill, 2),
            ))

            current_time += datetime.timedelta(hours=1)

        # Set current fill to the latest reading
        bin_obj.current_fill_percent = round(fill, 2)

        # Batch insert every 5000 readings
        if len(readings_batch) >= 5000:
            db.bulk_save_objects(readings_batch)
            readings_batch = []

    if readings_batch:
        db.bulk_save_objects(readings_batch)

    db.flush()


def generate_vehicles(db: Session) -> list[Vehicle]:
    """Create 3 collection vehicles with depots near the city center."""
    vehicles = []
    depot_positions = [
        (CENTER_LAT + 0.01, CENTER_LNG - 0.01),
        (CENTER_LAT - 0.02, CENTER_LNG + 0.02),
        (CENTER_LAT + 0.005, CENTER_LNG + 0.015),
    ]
    names = ["Truck Alpha", "Truck Beta", "Truck Gamma"]

    for i, (dlat, dlng) in enumerate(depot_positions):
        vehicle = Vehicle(
            name=names[i],
            capacity_liters=random.choice([1000, 1200, 1500]),
            depot_lat=round(dlat, 6),
            depot_lng=round(dlng, 6),
            current_lat=round(dlat, 6),
            current_lng=round(dlng, 6),
            is_active=True,
        )
        db.add(vehicle)
        vehicles.append(vehicle)

    db.flush()
    return vehicles


def generate_initial_alerts(db: Session, bins: list[Bin]):
    """Create alerts for bins that are currently above 85% fill."""
    for bin_obj in bins:
        if bin_obj.current_fill_percent > 85:
            alert = Alert(
                bin_id=bin_obj.id,
                zone=bin_obj.zone,
                alert_type="threshold",
                message=f"{bin_obj.name} is at {bin_obj.current_fill_percent:.0f}% capacity — collection needed urgently!",
                severity="critical",
                is_active=True,
            )
            db.add(alert)
        elif bin_obj.current_fill_percent > 70:
            alert = Alert(
                bin_id=bin_obj.id,
                zone=bin_obj.zone,
                alert_type="threshold",
                message=f"{bin_obj.name} is at {bin_obj.current_fill_percent:.0f}% capacity — schedule collection soon.",
                severity="warning",
                is_active=True,
            )
            db.add(alert)

    db.flush()


def seed_database(db: Session):
    """Main entry point: generate all synthetic data."""
    print("[Seeder] Generating bins...")
    bins = generate_bins(db)
    print(f"[Seeder] Created {len(bins)} bins")

    print("[Seeder] Generating fill readings (60 days)... this may take a moment")
    generate_fill_readings(db, bins)
    print("[Seeder] Fill readings generated")

    print("[Seeder] Generating vehicles...")
    vehicles = generate_vehicles(db)
    print(f"[Seeder] Created {len(vehicles)} vehicles")

    print("[Seeder] Generating initial alerts...")
    generate_initial_alerts(db, bins)

    db.commit()
    print("[Seeder] Database seeded successfully!")
