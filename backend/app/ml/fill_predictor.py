"""
Fill-level predictor — fits Prophet (or linear regression fallback) on a bin's
fill reading history and predicts when fill_percent will cross 100%.
"""
import datetime
import numpy as np
from sqlalchemy.orm import Session
from app.models import Bin, FillReading


# Lightweight cache: bin_id -> (cache_timestamp, reading_count, fill_val, result_dict)
_OVERFLOW_CACHE = {}


def predict_overflow(db: Session, bin_obj: Bin, use_prophet: bool = False) -> dict:
    """
    Predict when a bin will overflow based on its recent generation trends.
    Uses ultra-fast linear trend forecasting with Prophet option for deep single-bin inspection.
    """
    current_fill = float(bin_obj.current_fill_percent or 0.0)
    result = {
        "bin_id": int(bin_obj.id),
        "bin_name": str(bin_obj.name),
        "current_fill_percent": round(current_fill, 2),
        "fill_rate_per_day": 0.0,
        "fill_rate_per_hour": 0.0,
        "predicted_overflow_at": None,
        "hours_until_overflow": None,
    }

    # Query only recent 30 readings rather than 1,440 historical records
    readings = (
        db.query(FillReading)
        .filter(FillReading.bin_id == bin_obj.id)
        .order_by(FillReading.timestamp.desc())
        .limit(30)
        .all()
    )
    readings.reverse()

    if not readings:
        rate_per_hour = 3.5
        hours_to_full = max(0.0, (100.0 - current_fill) / rate_per_hour)
        now = datetime.datetime.now(datetime.timezone.utc)
        result["fill_rate_per_day"] = round(rate_per_hour * 24.0, 2)
        result["fill_rate_per_hour"] = round(rate_per_hour, 2)
        result["predicted_overflow_at"] = (now + datetime.timedelta(hours=hours_to_full)).isoformat()
        result["hours_until_overflow"] = round(hours_to_full, 2)
        return result

    # Check cache (valid for 60s)
    cache_key = (bin_obj.id, use_prophet)
    now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
    if cache_key in _OVERFLOW_CACHE:
        cached_ts, cached_count, cached_fill, cached_res = _OVERFLOW_CACHE[cache_key]
        if (now_ts - cached_ts < 60.0) and (abs(cached_fill - current_fill) < 0.2):
            res_copy = dict(cached_res)
            res_copy["current_fill_percent"] = round(current_fill, 2)
            return res_copy

    if use_prophet:
        try:
            calculated = _predict_with_prophet(readings, bin_obj, result)
        except Exception:
            calculated = _predict_with_linear(readings, bin_obj, result)
    else:
        calculated = _predict_with_linear(readings, bin_obj, result)

    _OVERFLOW_CACHE[cache_key] = (now_ts, len(readings), current_fill, calculated)
    return calculated


def _predict_with_prophet(readings, bin_obj, result: dict) -> dict:
    """Use Prophet for time series forecasting if available, else linear."""
    import pandas as pd
    from prophet import Prophet

    df = pd.DataFrame([
        {"ds": r.timestamp, "y": float(r.fill_percent)}
        for r in readings
    ])

    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=True,
        yearly_seasonality=False,
        changepoint_prior_scale=0.1,
    )
    model.fit(df)

    # Forecast next 7 days
    future = model.make_future_dataframe(periods=168, freq="h")
    forecast = model.predict(future)

    future_forecast = forecast[forecast["ds"] > df["ds"].max()]
    overflow_rows = future_forecast[future_forecast["yhat"] >= 100]

    # Compute fill rate from recent trend
    diffs = df["y"].diff()
    rising_diffs = diffs[(diffs > 0) & (diffs < 30)]
    if not rising_diffs.empty:
        rate_per_hour = float(rising_diffs.mean())
    else:
        rate_per_hour = 3.5

    result["fill_rate_per_hour"] = float(round(rate_per_hour, 2))
    result["fill_rate_per_day"] = float(round(rate_per_hour * 24.0, 2))

    if not overflow_rows.empty:
        overflow_time = overflow_rows.iloc[0]["ds"]
        now = datetime.datetime.utcnow()
        hours_left = float((overflow_time - now).total_seconds() / 3600)
        result["predicted_overflow_at"] = str(overflow_time.isoformat())
        result["hours_until_overflow"] = float(round(max(0.0, hours_left), 2))
    else:
        current_fill = float(bin_obj.current_fill_percent or 0.0)
        hours_to_full = float(max(0.0, (100.0 - current_fill) / max(0.1, rate_per_hour)))
        now = datetime.datetime.utcnow()
        result["predicted_overflow_at"] = str((now + datetime.timedelta(hours=hours_to_full)).isoformat())
        result["hours_until_overflow"] = float(round(hours_to_full, 2))

    return result


def _predict_with_linear(readings, bin_obj, result: dict) -> dict:
    """Robust trend predictor estimating fill rate across generation cycles."""
    fills = [float(r.fill_percent) for r in readings]
    current_fill = float(bin_obj.current_fill_percent if bin_obj.current_fill_percent is not None else (fills[-1] if fills else 0.0))

    # Calculate average rate of rise per step/hour
    if len(fills) >= 2:
        diffs = [fills[i] - fills[i-1] for i in range(1, len(fills)) if 0.05 < (fills[i] - fills[i-1]) < 30.0]
        if diffs:
            recent_diffs = diffs[-15:] if len(diffs) >= 15 else diffs
            rate_per_hour = float(np.mean(recent_diffs))
        else:
            rate_per_hour = 3.5
    else:
        rate_per_hour = 3.5

    # Diversity modifier based on zone & bin capacity
    zone_str = str(bin_obj.zone or "")
    zone_mod = 1.25 if "Central" in zone_str else (0.85 if "West" in zone_str else 1.05)
    cap_mod = 240.0 / max(120, float(bin_obj.capacity_liters or 240))
    rate_per_hour = max(1.2, min(8.0, rate_per_hour * zone_mod * cap_mod))

    fill_rate_per_day = float(round(rate_per_hour * 24.0, 2))
    result["fill_rate_per_hour"] = float(round(rate_per_hour, 2))
    result["fill_rate_per_day"] = fill_rate_per_day

    hours_to_full = float(max(0.0, (100.0 - current_fill) / max(0.1, rate_per_hour)))
    now = datetime.datetime.utcnow()
    overflow_time = now + datetime.timedelta(hours=hours_to_full)
    result["predicted_overflow_at"] = str(overflow_time.isoformat())
    result["hours_until_overflow"] = float(round(hours_to_full, 2))

    return result


def predict_fill_at(db: Session, bin_obj: Bin, hours_ahead: float) -> dict:
    """
    Predict the fill percentage of a bin N hours from now.
    """
    base = predict_overflow(db, bin_obj)
    current_fill = float(bin_obj.current_fill_percent or 0.0)
    rate_per_hour = float(base.get("fill_rate_per_hour") or (base.get("fill_rate_per_day", 0.0) / 24.0))
    if rate_per_hour <= 0.05:
        rate_per_hour = 3.0

    # Estimate predicted fill at T = now + hours_ahead
    predicted_fill = min(100.0, current_fill + rate_per_hour * float(hours_ahead))
    predicted_fill = max(0.0, predicted_fill)

    # Check overflow time
    hours_until_overflow = base.get("hours_until_overflow")
    if hours_until_overflow is not None:
        hours_until_overflow = float(hours_until_overflow)
    else:
        hours_until_overflow = float(max(0.0, (100.0 - current_fill) / max(0.1, rate_per_hour)))

    will_overflow = bool(hours_until_overflow <= float(hours_ahead))
    if will_overflow:
        predicted_fill = 100.0

    hours_left_from_target = max(0.0, hours_until_overflow - float(hours_ahead))

    # Urgency evaluated at target horizon
    if predicted_fill >= 80.0 or will_overflow or hours_left_from_target <= 3.0:
        urgency = "immediate"
    elif predicted_fill >= 60.0 or hours_left_from_target <= 12.0:
        urgency = "soon"
    elif predicted_fill >= 35.0 or hours_left_from_target <= 36.0:
        urgency = "scheduled"
    else:
        urgency = "ok"

    return {
        "bin_id": int(bin_obj.id),
        "lat": float(bin_obj.lat),
        "lng": float(bin_obj.lng),
        "bin_name": str(bin_obj.name),
        "zone": str(bin_obj.zone),
        "waste_type": str(bin_obj.waste_type.value if hasattr(bin_obj.waste_type, 'value') else bin_obj.waste_type),
        "hours_ahead": float(hours_ahead),
        "current_fill_percent": float(round(current_fill, 2)),
        "predicted_fill_percent": float(round(predicted_fill, 2)),
        "hours_until_overflow": float(round(hours_until_overflow, 2)),
        "predicted_overflow_at": str(base.get("predicted_overflow_at")) if base.get("predicted_overflow_at") else None,
        "will_overflow_before": bool(will_overflow),
        "collection_urgency": str(urgency),
    }



