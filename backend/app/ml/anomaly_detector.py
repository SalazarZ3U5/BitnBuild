"""
Anomaly detector — uses IsolationForest over zone daily volumes and
simple threshold alerts for bins > 85%.
"""
import datetime
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Bin, FillReading, Alert, WasteType


def run_anomaly_detection(db: Session) -> list[dict]:
    """
    Run anomaly detection:
    1. Threshold alerts: bins with fill > 85%
    2. IsolationForest on per-zone daily total waste volumes

    Returns list of newly created alert dicts.
    """
    new_alerts = []

    # ── 0. Special Alert for #1 Municipal Producer (Manek Chowk) ──
    top_bin = db.query(Bin).filter(Bin.name.ilike("%manek chowk%")).first()
    if top_bin:
        top_alert = (
            db.query(Alert)
            .filter(
                Alert.bin_id == top_bin.id,
                Alert.alert_type == "special_producer",
                Alert.is_active == True,
            )
            .first()
        )
        if not top_alert:
            alert = Alert(
                bin_id=top_bin.id,
                zone=top_bin.zone,
                alert_type="special_producer",
                message=f"🚨 [SPECIAL ALERT · #1 WASTE PRODUCER] Manek Chowk Food & Night Bazaar is Ahmedabad's highest volume waste generator ({top_bin.current_fill_percent:.0f}% fill). High-capacity compactor allocated!",
                severity="critical",
                is_active=True,
            )
            db.add(alert)
            db.flush()
            new_alerts.append({
                "id": alert.id,
                "bin_id": top_bin.id,
                "zone": top_bin.zone,
                "alert_type": "special_producer",
                "message": alert.message,
                "severity": alert.severity,
            })

    # ── 1. Threshold alerts ──────────────────────────────────────────────────
    high_fill_bins = db.query(Bin).filter(Bin.current_fill_percent > 85).all()
    for b in high_fill_bins:
        # Check if a recent active alert already exists for this bin
        existing = (
            db.query(Alert)
            .filter(
                Alert.bin_id == b.id,
                Alert.alert_type == "threshold",
                Alert.is_active == True,
            )
            .first()
        )
        if existing:
            continue

        alert = Alert(
            bin_id=b.id,
            zone=b.zone,
            alert_type="threshold",
            message=f"{b.name} is at {b.current_fill_percent:.0f}% capacity — collection needed urgently!",
            severity="critical" if b.current_fill_percent > 95 else "warning",
            is_active=True,
        )
        db.add(alert)
        db.flush()
        new_alerts.append({
            "id": alert.id,
            "bin_id": b.id,
            "zone": b.zone,
            "alert_type": "threshold",
            "message": alert.message,
            "severity": alert.severity,
        })

    # ── 2. IsolationForest anomaly detection on zone daily volumes ────────
    try:
        from sklearn.ensemble import IsolationForest

        zones = db.query(Bin.zone).distinct().all()
        zone_names = [z[0] for z in zones]

        for zone_name in zone_names:
            zone_bins = db.query(Bin).filter(Bin.zone == zone_name).all()
            zone_bin_ids = [b.id for b in zone_bins]

            if not zone_bin_ids:
                continue

            # Get daily total fill readings for the zone (last 60 days)
            cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=60)
            readings = (
                db.query(
                    func.date(FillReading.timestamp).label("day"),
                    func.sum(FillReading.fill_percent).label("total_fill"),
                )
                .filter(
                    FillReading.bin_id.in_(zone_bin_ids),
                    FillReading.timestamp >= cutoff,
                )
                .group_by(func.date(FillReading.timestamp))
                .all()
            )

            if len(readings) < 10:
                continue

            daily_volumes = np.array([r.total_fill for r in readings]).reshape(-1, 1)

            iso_forest = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100,
            )
            predictions = iso_forest.fit_predict(daily_volumes)

            # Check if the most recent days are anomalous
            recent_anomalies = predictions[-7:]  # last 7 days
            anomaly_count = sum(1 for p in recent_anomalies if p == -1)

            if anomaly_count >= 2:
                existing = (
                    db.query(Alert)
                    .filter(
                        Alert.zone == zone_name,
                        Alert.alert_type == "anomaly",
                        Alert.is_active == True,
                    )
                    .first()
                )
                if existing:
                    continue

                avg_recent = float(np.mean(daily_volumes[-7:]))
                avg_overall = float(np.mean(daily_volumes))
                pct_above = ((avg_recent - avg_overall) / avg_overall * 100) if avg_overall > 0 else 0

                alert = Alert(
                    zone=zone_name,
                    alert_type="anomaly",
                    message=(
                        f"{zone_name} showing unusual waste generation: "
                        f"recent average is {pct_above:.0f}% {'above' if pct_above > 0 else 'below'} normal. "
                        f"({anomaly_count}/7 recent days flagged as anomalous)"
                    ),
                    severity="warning",
                    is_active=True,
                )
                db.add(alert)
                db.flush()
                new_alerts.append({
                    "id": alert.id,
                    "zone": zone_name,
                    "alert_type": "anomaly",
                    "message": alert.message,
                    "severity": alert.severity,
                })

    except ImportError:
        pass  # scikit-learn not available

    db.commit()
    return new_alerts
