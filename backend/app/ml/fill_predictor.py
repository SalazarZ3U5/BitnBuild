"""
Fill-level predictor — fits Prophet (or linear regression fallback) on a bin's
fill reading history and predicts when fill_percent will cross 100%.
"""
import datetime
import numpy as np
from sqlalchemy.orm import Session
from app.models import Bin, FillReading


def predict_overflow(db: Session, bin_obj: Bin) -> dict:
    """
    Predict when a bin will overflow.

    Returns:
        {
            "bin_id": int,
            "current_fill_percent": float,
            "fill_rate_per_day": float,
            "predicted_overflow_at": str | None,
            "hours_until_overflow": float | None,
        }
    """
    readings = (
        db.query(FillReading)
        .filter(FillReading.bin_id == bin_obj.id)
        .order_by(FillReading.timestamp)
        .all()
    )

    current_fill = bin_obj.current_fill_percent or 0.0
    result = {
        "bin_id": bin_obj.id,
        "bin_name": bin_obj.name,
        "current_fill_percent": current_fill,
        "fill_rate_per_day": 0.0,
        "predicted_overflow_at": None,
        "hours_until_overflow": None,
    }

    if len(readings) < 10:
        return result

    # Use the last 14 days of readings
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=14)
    recent = [r for r in readings if r.timestamp >= cutoff]
    if len(recent) < 5:
        recent = readings[-168:]  # last week worth of hourly

    try:
        return _predict_with_prophet(recent, bin_obj, result)
    except Exception:
        return _predict_with_linear(recent, bin_obj, result)


def _predict_with_prophet(readings, bin_obj, result: dict) -> dict:
    """Use Prophet for time series forecasting."""
    import pandas as pd
    from prophet import Prophet

    df = pd.DataFrame([
        {"ds": r.timestamp, "y": r.fill_percent}
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
    forecast = future.copy()
    forecast = model.predict(future)

    # Find when yhat crosses 100
    future_forecast = forecast[forecast["ds"] > df["ds"].max()]
    overflow_rows = future_forecast[future_forecast["yhat"] >= 100]

    # Compute fill rate from recent trend
    if len(df) >= 2:
        total_hours = (df["ds"].max() - df["ds"].min()).total_seconds() / 3600
        if total_hours > 0:
            # Sum positive increments only (ignore collection resets)
            positive_changes = df["y"].diff().clip(lower=0).sum()
            rate_per_hour = positive_changes / total_hours
            result["fill_rate_per_day"] = round(rate_per_hour * 24, 2)

    if not overflow_rows.empty:
        overflow_time = overflow_rows.iloc[0]["ds"]
        now = datetime.datetime.utcnow()
        hours_left = (overflow_time - now).total_seconds() / 3600
        result["predicted_overflow_at"] = overflow_time.isoformat()
        result["hours_until_overflow"] = round(max(0, hours_left), 2)

    return result


def _predict_with_linear(readings, bin_obj, result: dict) -> dict:
    """Linear regression fallback — simple trend line on recent readings."""
    if len(readings) < 2:
        return result

    # Convert timestamps to hours-since-first
    t0 = readings[0].timestamp
    hours = np.array([(r.timestamp - t0).total_seconds() / 3600 for r in readings])
    fills = np.array([r.fill_percent for r in readings])

    # Find recent upward trend (readings since last collection)
    # Detect last major drop (collection event)
    last_reset_idx = 0
    for i in range(1, len(fills)):
        if fills[i] - fills[i - 1] < -30:
            last_reset_idx = i

    hours_since_reset = hours[last_reset_idx:] - hours[last_reset_idx]
    fills_since_reset = fills[last_reset_idx:]

    if len(hours_since_reset) < 2:
        return result

    # Linear regression: fill = m * hours + b
    coeffs = np.polyfit(hours_since_reset, fills_since_reset, 1)
    slope = coeffs[0]  # % per hour

    result["fill_rate_per_day"] = round(slope * 24, 2)

    current_fill = fills_since_reset[-1]
    if slope > 0:
        hours_to_full = (100 - current_fill) / slope
        now = datetime.datetime.utcnow()
        overflow_time = now + datetime.timedelta(hours=hours_to_full)
        result["predicted_overflow_at"] = overflow_time.isoformat()
        result["hours_until_overflow"] = round(max(0, hours_to_full), 2)

    return result
