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

# Accurate Ahmedabad Landmark Locations with exact coordinates and zones:
AHMEDABAD_LANDMARK_BINS = [
    # ── West Zone (Navrangpura / Ashram Rd / C.G. Rd) ───────────────────────
    {
        "name": "Law Garden Market",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0232, "lng": 72.5574,
        "capacity_liters": 240, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "C.G. Road Panchvati",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0265, "lng": 72.5582,
        "capacity_liters": 360, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "C.G. Road Swastik Cross",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0335, "lng": 72.5588,
        "capacity_liters": 480, "waste_type": WasteType.PAPER
    },
    {
        "name": "Gujarat University Library",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0372, "lng": 72.5458,
        "capacity_liters": 240, "waste_type": WasteType.PAPER
    },
    {
        "name": "LD College of Engineering (Campus)",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0338, "lng": 72.5467,
        "capacity_liters": 480, "waste_type": WasteType.OTHER
    },
    {
        "name": "Mithakhali Six Roads",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0278, "lng": 72.5620,
        "capacity_liters": 240, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Ambawadi Circle West",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0215, "lng": 72.5510,
        "capacity_liters": 120, "waste_type": WasteType.METAL
    },
    {
        "name": "Sardar Patel Stadium Navrangpura",
        "zone": "West Zone (Navrangpura)",
        "lat": 23.0420, "lng": 72.5645,
        "capacity_liters": 480, "waste_type": WasteType.ORGANIC
    },

    # ── North West Zone (Bodakdev / Vastrapur / Thaltej) ────────────────────
    {
        "name": "Science City Main Plaza",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0785, "lng": 72.5020,
        "capacity_liters": 480, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Science City Road Circle",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0720, "lng": 72.5110,
        "capacity_liters": 360, "waste_type": WasteType.OTHER
    },
    {
        "name": "Bodakdev Judges Bungalow Rd",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0380, "lng": 72.5180,
        "capacity_liters": 240, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Sindhu Bhavan Taj Skyline",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0425, "lng": 72.5080,
        "capacity_liters": 360, "waste_type": WasteType.GLASS
    },
    {
        "name": "Alpha One Mall Vastrapur",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0402, "lng": 72.5312,
        "capacity_liters": 480, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Vastrapur Lake Garden",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0365, "lng": 72.5295,
        "capacity_liters": 360, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "IIM Ahmedabad Main Gate",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0315, "lng": 72.5328,
        "capacity_liters": 240, "waste_type": WasteType.PAPER
    },
    {
        "name": "S.G. Highway Bodakdev Junction",
        "zone": "North West Zone (Bodakdev)",
        "lat": 23.0470, "lng": 72.5190,
        "capacity_liters": 480, "waste_type": WasteType.OTHER
    },

    # ── South West Zone (Satellite / Prahlad Nagar / Sarkhej) ───────────────
    {
        "name": "Prahlad Nagar Garden East",
        "zone": "South West Zone (Satellite)",
        "lat": 23.0125, "lng": 72.5080,
        "capacity_liters": 360, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Prahlad Nagar Corporate Road",
        "zone": "South West Zone (Satellite)",
        "lat": 23.0105, "lng": 72.5045,
        "capacity_liters": 480, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Satellite Shivranjani Cross",
        "zone": "South West Zone (Satellite)",
        "lat": 23.0210, "lng": 72.5320,
        "capacity_liters": 360, "waste_type": WasteType.OTHER
    },
    {
        "name": "Jodhpur Gam Cross Road",
        "zone": "South West Zone (Satellite)",
        "lat": 23.0180, "lng": 72.5230,
        "capacity_liters": 240, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Shyamal Cross Road BRTS",
        "zone": "South West Zone (Satellite)",
        "lat": 23.0135, "lng": 72.5285,
        "capacity_liters": 360, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Sarkhej Roza Heritage",
        "zone": "South West Zone (Satellite)",
        "lat": 22.9805, "lng": 72.5025,
        "capacity_liters": 240, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Sarkhej Highway Sanand Circle",
        "zone": "South West Zone (Satellite)",
        "lat": 22.9860, "lng": 72.5090,
        "capacity_liters": 480, "waste_type": WasteType.OTHER
    },
    {
        "name": "Vejalpur APMC Market",
        "zone": "South West Zone (Satellite)",
        "lat": 23.0035, "lng": 72.5210,
        "capacity_liters": 360, "waste_type": WasteType.ORGANIC
    },

    # ── Central Zone (Old City / Khadia / Riverfront) ───────────────────────
    {
        "name": "Sabarmati Riverfront Vallabh Sadan",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0335, "lng": 72.5695,
        "capacity_liters": 360, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Sabarmati Riverfront Event Centre",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0220, "lng": 72.5718,
        "capacity_liters": 480, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Ellis Bridge Victoria Garden",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0210, "lng": 72.5730,
        "capacity_liters": 240, "waste_type": WasteType.OTHER
    },
    {
        "name": "Nehru Bridge Lal Darwaja",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0280, "lng": 72.5720,
        "capacity_liters": 360, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Sidi Saiyyed Mosque Plaza",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0275, "lng": 72.5785,
        "capacity_liters": 240, "waste_type": WasteType.OTHER
    },
    {
        "name": "Bhadra Fort Teen Darwaja",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0245, "lng": 72.5780,
        "capacity_liters": 360, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Manek Chowk Gold Bazaar",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0220, "lng": 72.5870,
        "capacity_liters": 480, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Kalupur Railway Terminal",
        "zone": "Central Zone (Khadia/Riverfront)",
        "lat": 23.0265, "lng": 72.5990,
        "capacity_liters": 480, "waste_type": WasteType.PLASTIC
    },

    # ── East Zone (Bapunagar / Nikol / Maninagar / Kankaria) ───────────────
    {
        "name": "Kankaria Lake Gate 1",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 23.0065, "lng": 72.5995,
        "capacity_liters": 480, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Kankaria Lake Balvatika",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 22.9985, "lng": 72.6020,
        "capacity_liters": 360, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Maninagar Railway Station",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 22.9980, "lng": 72.6105,
        "capacity_liters": 480, "waste_type": WasteType.OTHER
    },
    {
        "name": "Gita Mandir Central Bus Port",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 23.0135, "lng": 72.5875,
        "capacity_liters": 480, "waste_type": WasteType.OTHER
    },
    {
        "name": "Bapunagar Diamond Market",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 23.0425, "lng": 72.6280,
        "capacity_liters": 360, "waste_type": WasteType.METAL
    },
    {
        "name": "Bapunagar Industrial Estate",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 23.0480, "lng": 72.6340,
        "capacity_liters": 480, "waste_type": WasteType.PLASTIC
    },
    {
        "name": "Nikol Lake Garden",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 23.0520, "lng": 72.6510,
        "capacity_liters": 360, "waste_type": WasteType.ORGANIC
    },
    {
        "name": "Nikol Gam Ring Road Circle",
        "zone": "East Zone (Bapunagar/Nikol)",
        "lat": 23.0450, "lng": 72.6480,
        "capacity_liters": 240, "waste_type": WasteType.PLASTIC
    },
]


def generate_bins(db: Session) -> list[Bin]:
    """Create 40 bins at authentic, verified Ahmedabad landmark locations."""
    bins = []
    for data in AHMEDABAD_LANDMARK_BINS:
        bin_obj = Bin(
            name=data["name"],
            lat=round(data["lat"], 6),
            lng=round(data["lng"], 6),
            capacity_liters=data["capacity_liters"],
            waste_type=data["waste_type"],
            zone=data["zone"],
            current_fill_percent=0.0,
        )
        db.add(bin_obj)
        bins.append(bin_obj)

    db.flush()
    return bins


def sync_accurate_landmark_bins(db: Session) -> list[Bin]:
    """
    Synchronizes existing database bins so their names, zones, and coordinates
    accurately reflect authentic Ahmedabad landmarks.
    """
    existing_bins = db.query(Bin).order_by(Bin.id).all()
    if not existing_bins:
        return generate_bins(db)

    for i, bin_obj in enumerate(existing_bins):
        if i < len(AHMEDABAD_LANDMARK_BINS):
            data = AHMEDABAD_LANDMARK_BINS[i]
            bin_obj.name = data["name"]
            bin_obj.zone = data["zone"]
            bin_obj.lat = round(data["lat"], 6)
            bin_obj.lng = round(data["lng"], 6)
            bin_obj.capacity_liters = data["capacity_liters"]
            bin_obj.waste_type = data["waste_type"]

    db.commit()
    return existing_bins


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
        name_lower = bin_obj.name.lower()

        # Authentic Ahmedabad waste hierarchy: Wholesale markets & transit lead, LDCE at rank 7-8
        if "manek chowk" in name_lower:
            daily_rate = random.uniform(50.0, 56.0)  # #1 Ahmedabad Waste Hotspot (Street Food & Night Bazaar)
            collection_interval_hours = 30
            target_final_fill = random.uniform(92.0, 97.0)
        elif "kalupur" in name_lower:
            daily_rate = random.uniform(44.0, 48.0)  # #2 Major Transit & Wholesale Vegetable Market
            collection_interval_hours = 36
            target_final_fill = random.uniform(88.0, 94.0)
        elif "apmc" in name_lower:
            daily_rate = random.uniform(39.0, 43.0)  # #3 Agricultural Produce Market Committee
            collection_interval_hours = 42
            target_final_fill = random.uniform(84.0, 91.0)
        elif "gita mandir" in name_lower:
            daily_rate = random.uniform(34.0, 38.0)  # #4 Central Bus Terminal (100k+ passengers)
            collection_interval_hours = 48
            target_final_fill = random.uniform(80.0, 87.0)
        elif "alpha one" in name_lower:
            daily_rate = random.uniform(29.0, 33.0)  # #5 Vastrapur Mega Mall & Food Court
            collection_interval_hours = 48
            target_final_fill = random.uniform(76.0, 83.0)
        elif "bapunagar industrial" in name_lower:
            daily_rate = random.uniform(24.0, 28.0)  # #6 Dense Manufacturing & Textile Estate
            collection_interval_hours = 54
            target_final_fill = random.uniform(70.0, 78.0)
        elif "c.g. road swastik" in name_lower:
            daily_rate = random.uniform(22.0, 25.0)  # #7 Commercial Shopping Corridor
            collection_interval_hours = 60
            target_final_fill = random.uniform(65.0, 72.0)
        elif "ld college" in name_lower:
            daily_rate = random.uniform(18.5, 21.0)  # #8 Educational Campus, Hostels & Canteen (~20%/day)
            collection_interval_hours = 72
            target_final_fill = random.uniform(58.0, 66.0)
        else:
            daily_rate = random.uniform(3.0, 14.0)  # Ranks 9-40
            collection_interval_hours = random.randint(3, 7) * 24
            if idx < 16:
                target_final_fill = random.uniform(45.0, 60.0)
            else:
                target_final_fill = random.uniform(15.0, 45.0)

        hourly_rate = daily_rate / 24.0
        hours_since_collection = 0

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
    """Create alerts for bins, with a high-priority Special Alert for Ahmedabad's #1 generator (Manek Chowk)."""
    for bin_obj in bins:
        is_top = "manek chowk" in bin_obj.name.lower()
        if is_top:
            alert = Alert(
                bin_id=bin_obj.id,
                zone=bin_obj.zone,
                alert_type="special_producer",
                message=f"🚨 [SPECIAL ALERT · #1 WASTE PRODUCER] Manek Chowk Food & Night Bazaar is Ahmedabad's highest volume waste generator ({bin_obj.current_fill_percent:.0f}% fill). High-capacity compactor allocated!",
                severity="critical",
                is_active=True,
            )
            db.add(alert)
        elif bin_obj.current_fill_percent > 85:
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
