"""
Synthetic data generator for Ahmedabad Municipal Corporation (AMC) Waste Management.
Creates ~40 bins across Ahmedabad, backfills 60 days of hourly fill readings,
creates 3 AMC collection vehicles, and generates initial alerts.
"""
import random
import datetime
import math
from sqlalchemy.orm import Session
from app.models import Bin, FillReading, Vehicle, Alert, WasteType

# Ahmedabad Municipal Corporation (AMC) center coordinates
CENTER_LAT = 23.0225
CENTER_LNG = 72.5714

# Official AMC administrative zones with approximate geographic coordinates
ZONES = {
    "West Zone (Navrangpura)": {"lat_offset": 0.015, "lng_offset": -0.015, "bins": 8},
    "North West Zone (Bodakdev)": {"lat_offset": 0.035, "lng_offset": -0.040, "bins": 8},
    "South West Zone (Satellite)": {"lat_offset": -0.015, "lng_offset": -0.045, "bins": 8},
    "Central Zone (Khadia/Riverfront)": {"lat_offset": 0.005, "lng_offset": 0.010, "bins": 8},
    "East Zone (Bapunagar/Nikol)": {"lat_offset": 0.020, "lng_offset": 0.055, "bins": 8},
}

WASTE_TYPES = list(WasteType)

AHMEDABAD_LANDMARKS = [
    "Sabarmati Riverfront", "Kankaria Lake", "Manek Chowk", "Law Garden",
    "Vastrapur Lake", "IIM Ahmedabad", "Science City", "Sindhu Bhavan",
    "Kalupur Terminal", "Paldi Market", "Alpha One Mall", "Ellis Bridge",
    "Sidi Saiyyed Plaza", "Bhadra Fort", "Prahlad Nagar Garden", "Gujarat University",
    "Civil Hospital", "Gita Mandir Bus Port", "Naranpura Sports Complex", "Sarkhej Roza",
    "Nehru Bridge", "Ambawadi Circle", "C.G. Road", "S.G. Highway"
]


def generate_bins(db: Session) -> list[Bin]:
    """Create ~40 bins across Ahmedabad AMC zones."""
    bins = []
    bin_counter = 1

    for zone_name, zone_info in ZONES.items():
        for i in range(zone_info["bins"]):
            # Random position within the zone
            lat = CENTER_LAT + zone_info["lat_offset"] + random.uniform(-0.012, 0.012)
            lng = CENTER_LNG + zone_info["lng_offset"] + random.uniform(-0.012, 0.012)
            capacity = random.choice([120, 240, 360, 480])
            waste_type = random.choice(WASTE_TYPES)
            landmark = random.choice(AHMEDABAD_LANDMARKS)

            bin_obj = Bin(
                name=f"{landmark} Bin {bin_counter}",
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

    for idx, bin_obj in enumerate(bins):
        fill = random.uniform(0, 10)  # Start fill
        daily_rate = random.uniform(2, 8)  # % per day rise
        hourly_rate = daily_rate / 24.0
        # Random collection interval (every 3-7 days)
        collection_interval_hours = random.randint(3, 7) * 24
        hours_since_collection = 0

        # Define target final fill band for realistic demonstration:
        # ~20% of bins critical (82-96%), ~35% warning (52-78%), ~45% normal (15-48%)
        if idx < 8:
            target_final_fill = random.uniform(82, 96)
        elif idx < 22:
            target_final_fill = random.uniform(52, 78)
        else:
            target_final_fill = random.uniform(15, 48)

        current_time = start
        while current_time <= now:
            noise = random.gauss(0, 0.4)
            fill += hourly_rate + noise
            fill = max(0, min(fill, 100))
            hours_since_collection += 1

            # Last 48 hours: smoothly guide toward target final fill
            hours_remaining = (now - current_time).total_seconds() / 3600.0
            if hours_remaining <= 48:
                # Do not trigger a reset in final 48h, blend towards target
                fill += (target_final_fill - fill) * 0.08
            else:
                # Normal historical sawtooth collection event
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
    """Create 4 AMC collection vehicles with depots covering 4 Ahmedabad zones."""
    vehicles = []
    depot_positions = [
        (CENTER_LAT + 0.012, CENTER_LNG - 0.015),  # West Depot (Ashram Road / Navrangpura)
        (CENTER_LAT - 0.020, CENTER_LNG + 0.025),  # South Depot (Kankaria / Danilimda)
        (CENTER_LAT + 0.025, CENTER_LNG - 0.035),  # North-West Depot (Bodakdev / SG Highway)
        (CENTER_LAT - 0.010, CENTER_LNG + 0.035),  # East Depot (Maninagar / Nikol)
    ]
    names = [
        "AMC Swachhata Vahini 01",
        "AMC Swachhata Vahini 02",
        "AMC Swachhata Vahini 03",
        "AMC Swachhata Vahini 04",
    ]

    for i, (dlat, dlng) in enumerate(depot_positions):
        vehicle = Vehicle(
            name=names[i],
            capacity_liters=10000.0,
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
