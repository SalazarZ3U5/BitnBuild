"""
Mathematical fill-level predictor for municipal smart bins.
Implements:
1. Ordinary Least Squares (OLS) Linear Regression on historical accumulation cycles.
2. Diurnal Circadian Seasonality Integration S(t) calibrated for Ahmedabad municipal activity.
3. Analytical & Numerical Root-Finding for exact time-to-overflow (t*).
4. Error Variance Diffusion for statistical confidence bounds (90% CI).
5. Continuous Multi-Horizon Forecasting (0h - 72h).
"""
import datetime
import time
import numpy as np
from sqlalchemy.orm import Session
from app.models import Bin, FillReading

# ── Ahmedabad Diurnal Waste Generation Profile ──────────────────────────────────
# Normalized 24-hour activity distribution for Ahmedabad (IST = UTC+5:30).
# Modeled across commercial markets, transit hubs, and residential zones.
# Sum = 24.0, Mean = 1.000 (Exact unitary normalization).
HOURLY_DIURNAL_WEIGHTS = [
    0.25, 0.20, 0.20, 0.20, 0.25, 0.45,  # 00:00 - 05:00: Dormant night sleep
    0.80, 1.15, 1.45, 1.50, 1.55, 1.40,  # 06:00 - 11:00: Morning commercial & office peak
    1.25, 1.20, 1.10, 1.15, 1.40, 1.50,  # 12:00 - 17:00: Afternoon plateau & school/market run
    1.70, 1.65, 1.40, 1.05, 0.70, 0.50,  # 18:00 - 23:00: Evening street food & night markets
]

# In-memory model parameter cache: bin_id -> (timestamp, current_fill, rate, r2, residual_std)
_MODEL_CACHE = {}


def calculate_diurnal_multiplier(hour_of_day: float) -> float:
    """
    Returns the instantaneous municipal waste generation multiplier S(h)
    for a given hour in Ahmedabad local time (0.0 to 23.99).
    """
    h = float(hour_of_day) % 24.0
    h_idx = int(h)
    w_curr = HOURLY_DIURNAL_WEIGHTS[h_idx % 24]
    w_next = HOURLY_DIURNAL_WEIGHTS[(h_idx + 1) % 24]
    # Linear interpolation between discrete hour centers
    frac = h - h_idx
    return float(w_curr + frac * (w_next - w_curr))


def integrate_diurnal_factor(start_hour: float, duration_hours: float) -> float:
    """
    Computes the exact piecewise definite integral:
        I(t0, Δt) = ∫[0 to Δt] S((start_hour + τ) mod 24) dτ

    Mathematical Properties:
    - Exactly 24.0 for any 24h duration, regardless of starting phase.
    - Exactly 48.0 for 48h, 72.0 for 72h.
    - Monotonically increasing for all Δt >= 0.
    """
    if duration_hours <= 0.0:
        return 0.0

    full_days = int(duration_hours // 24)
    remainder = duration_hours % 24
    total = full_days * 24.0

    cur = float(start_hour) % 24.0
    rem = remainder
    while rem > 1e-6:
        cur_int = int(cur)
        next_boundary = float(cur_int + 1)
        step = min(rem, next_boundary - cur)
        weight = HOURLY_DIURNAL_WEIGHTS[cur_int % 24]
        total += step * weight
        rem -= step
        cur = (cur + step) % 24.0

    return float(total)


def solve_exact_overflow_time(current_fill: float, base_rate: float, start_hour: float) -> float:
    """
    Exact analytical root-finding to solve for t* >= 0 such that:
        current_fill + base_rate * ∫[0 to t*] S((start_hour + τ) mod 24) dτ = 100.0

    Returns:
        Hours until overflow as a float (0.0 if already full, up to 720.0h max).
    """
    needed = 100.0 - float(current_fill)
    if needed <= 0.0:
        return 0.0
    if base_rate <= 0.05:
        return 999.0

    cur_h = float(start_hour) % 24.0
    accumulated_hours = 0.0
    accumulated_fill = 0.0

    # March hour-by-hour until reaching or exceeding threshold
    while accumulated_hours < 720.0:
        h_idx = int(cur_h) % 24
        w = HOURLY_DIURNAL_WEIGHTS[h_idx]
        fill_this_hour = base_rate * w

        if accumulated_fill + fill_this_hour >= needed:
            # Linear interpolation within this specific hour step
            frac = (needed - accumulated_fill) / max(1e-5, fill_this_hour)
            return float(round(accumulated_hours + frac, 2))

        accumulated_fill += fill_this_hour
        accumulated_hours += 1.0
        cur_h = (cur_h + 1.0) % 24.0

    return float(round(accumulated_hours, 2))


def fit_accumulation_rate_ols(readings: list, bin_obj: Bin) -> tuple[float, float, float]:
    """
    Performs Ordinary Least Squares (OLS) regression across historical sawtooth cycles.

    Mathematical process:
    1. Segments readings into monotonic accumulation intervals (resets at Δy < -15%).
    2. For each cycle with N >= 4 readings, computes the OLS slope:
           β = Cov(t, y) / Var(t)
       and coefficient of determination R².
    3. Computes the median slope across cycles (robust against sensor anomalies).
    4. If readings are insufficient, computes empirical physical prior based on
       bin capacity, zone characteristics, and waste type.

    Returns:
        (rate_per_hour, r_squared, residual_std)
    """
    fills = [float(r.fill_percent) for r in readings] if readings else []

    # Detect accumulation cycles
    cycles = []
    current_cycle = [fills[0]] if fills else []
    for i in range(1, len(fills)):
        # Sawtooth drop: emptying event
        if fills[i] - fills[i - 1] < -15.0 or (fills[i - 1] > 45.0 and fills[i] < 20.0):
            if len(current_cycle) >= 4:
                cycles.append(current_cycle)
            current_cycle = [fills[i]]
        else:
            current_cycle.append(fills[i])
    if len(current_cycle) >= 4:
        cycles.append(current_cycle)

    cycle_slopes = []
    r2_scores = []
    residuals = []

    for c in cycles:
        n = len(c)
        t = np.arange(n, dtype=float)
        cov = float(np.cov(t, c)[0, 1]) if n > 1 else 0.0
        var_t = float(np.var(t)) if n > 1 else 0.0
        var_y = float(np.var(c)) if n > 1 else 0.0

        if var_t > 0:
            slope = cov / var_t
            if 0.1 <= slope <= 15.0:
                cycle_slopes.append(slope)
                if var_y > 0:
                    r2 = (cov ** 2) / (var_t * var_y)
                    r2_scores.append(r2)
                preds = np.mean(c) + slope * (t - np.mean(t))
                residuals.extend(list(np.abs(np.array(c) - preds)))

    if cycle_slopes:
        median_slope = float(np.median(cycle_slopes))
        avg_r2 = float(np.median(r2_scores)) if r2_scores else 0.88
        res_std = float(np.std(residuals)) if residuals else 1.20
        return median_slope, avg_r2, res_std

    # Empirical Prior Formulation if no historical cycles detected
    zone_str = str(getattr(bin_obj, "zone", "") or "")
    name_lower = str(getattr(bin_obj, "name", "") or "").lower()
    capacity = float(getattr(bin_obj, "capacity_liters", 240) or 240)
    waste_type = str(getattr(bin_obj, "waste_type", "Other") or "")

    # Baseline rate by location hierarchy
    if "manek chowk" in name_lower:
        base_rate = 2.35  # #1 Hotspot: Street Food & Night Bazaar (~56%/day)
    elif "kalupur" in name_lower:
        base_rate = 1.95  # #2 Major Transit (~46%/day)
    elif "apmc" in name_lower:
        base_rate = 1.70  # #3 Wholesale Produce (~41%/day)
    elif "gita mandir" in name_lower:
        base_rate = 1.50  # #4 Central Bus Terminal (~36%/day)
    elif "alpha one" in name_lower:
        base_rate = 1.30  # #5 Mall & Food Court (~31%/day)
    elif "bapunagar industrial" in name_lower:
        base_rate = 1.10  # #6 Industrial Estate (~26%/day)
    elif "c.g. road swastik" in name_lower:
        base_rate = 1.00  # #7 Shopping Corridor (~24%/day)
    elif "ld college" in name_lower:
        base_rate = 0.85  # #8 Educational Campus (~20%/day)
    else:
        # Zone-based prior
        if "Central" in zone_str:
            base_rate = 1.15
        elif "North West" in zone_str:
            base_rate = 0.90
        elif "East" in zone_str:
            base_rate = 0.85
        else:
            base_rate = 0.70

    # Physical capacity scaling factor
    cap_modifier = 240.0 / max(120.0, capacity)
    # Waste type multiplier
    waste_mult = 1.20 if "Organic" in waste_type else (1.05 if "Plastic" in waste_type else 0.95)
    rate = max(0.20, min(8.0, base_rate * cap_modifier * waste_mult))

    return float(round(rate, 3)), 0.85, 1.50


def calculate_confidence_bounds(
    predicted_fill: float, hours_ahead: float, base_rate: float, residual_std: float, confidence_level: float = 0.90
) -> tuple[float, float]:
    """
    Error variance diffusion over time horizon Δt:
        σ(Δt) = σ_residual * sqrt(Δt) + 0.02 * base_rate * Δt
    """
    dt = max(1.0, float(hours_ahead))
    sigma = float(residual_std) * np.sqrt(dt) + 0.02 * float(base_rate) * dt
    z = 1.645 if confidence_level >= 0.90 else 1.28
    lower = max(0.0, round(predicted_fill - z * sigma, 1))
    upper = min(100.0, round(predicted_fill + z * sigma, 1))
    return lower, upper


def classify_collection_urgency(predicted_fill: float, hours_until_overflow: float, hours_ahead: float) -> str:
    """
    Urgency classification criteria:
    - immediate: predicted >= 80% OR overflows within forecast window OR overflows in <= 4.0h
    - soon: predicted >= 60% OR overflows in <= 16.0h
    - scheduled: predicted >= 35% OR overflows in <= 36.0h
    - ok: nominal safe fill
    """
    if predicted_fill >= 80.0 or hours_until_overflow <= float(hours_ahead) or hours_until_overflow <= 4.0:
        return "immediate"
    elif predicted_fill >= 60.0 or hours_until_overflow <= 16.0:
        return "soon"
    elif predicted_fill >= 35.0 or hours_until_overflow <= 36.0:
        return "scheduled"
    else:
        return "ok"


def _get_bin_model_parameters(db: Session, bin_obj: Bin) -> tuple[float, float, float]:
    """
    Fetches or computes cached regression parameters for a bin.
    Cache is invalidated after 60 seconds or on significant fill level change.
    """
    cache_key = int(bin_obj.id)
    cur_fill = float(bin_obj.current_fill_percent or 0.0)
    now_ts = time.time()

    if cache_key in _MODEL_CACHE:
        cached_ts, cached_fill, rate, r2, res_std = _MODEL_CACHE[cache_key]
        if (now_ts - cached_ts < 60.0) and (abs(cached_fill - cur_fill) < 1.0):
            return rate, r2, res_std

    # Query last 300 readings (~12 days of hourly data) for fast, robust OLS fitting
    readings = (
        db.query(FillReading)
        .filter(FillReading.bin_id == bin_obj.id)
        .order_by(FillReading.timestamp.desc())
        .limit(300)
        .all()
    )
    readings.reverse()

    rate, r2, res_std = fit_accumulation_rate_ols(readings, bin_obj)
    _MODEL_CACHE[cache_key] = (now_ts, cur_fill, rate, r2, res_std)
    return rate, r2, res_std


def predict_fill_at(db: Session, bin_obj: Bin, hours_ahead: float) -> dict:
    """
    Predict the fill percentage and overflow trajectory of a bin N hours from now.
    """
    current_fill = float(bin_obj.current_fill_percent or 0.0)
    rate_per_hour, r2, res_std = _get_bin_model_parameters(db, bin_obj)

    # Current Ahmedabad local time (UTC+5:30)
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    ahmedabad_now = now_utc + datetime.timedelta(hours=5, minutes=30)
    start_hour = ahmedabad_now.hour + ahmedabad_now.minute / 60.0

    # Diurnal continuous integration over the horizon
    diurnal_factor = integrate_diurnal_factor(start_hour, float(hours_ahead))
    delta_fill = rate_per_hour * diurnal_factor

    # Predicted fill level with saturation cap
    raw_fill = current_fill + delta_fill
    predicted_fill = min(100.0, max(0.0, raw_fill))

    # Analytical time-to-overflow
    hours_until_overflow = solve_exact_overflow_time(current_fill, rate_per_hour, start_hour)
    will_overflow = bool(hours_until_overflow <= float(hours_ahead))

    if will_overflow:
        predicted_fill = 100.0

    urgency = classify_collection_urgency(predicted_fill, hours_until_overflow, float(hours_ahead))
    lower_ci, upper_ci = calculate_confidence_bounds(predicted_fill, float(hours_ahead), rate_per_hour, res_std)

    overflow_time = ahmedabad_now + datetime.timedelta(hours=hours_until_overflow)
    overflow_iso = overflow_time.isoformat() if hours_until_overflow < 720.0 else None

    return {
        "bin_id": int(bin_obj.id),
        "lat": float(bin_obj.lat),
        "lng": float(bin_obj.lng),
        "bin_name": str(bin_obj.name),
        "zone": str(bin_obj.zone),
        "waste_type": str(bin_obj.waste_type.value if hasattr(bin_obj.waste_type, "value") else bin_obj.waste_type),
        "hours_ahead": float(hours_ahead),
        "current_fill_percent": float(round(current_fill, 2)),
        "predicted_fill_percent": float(round(predicted_fill, 2)),
        "fill_percent": float(round(predicted_fill, 2)),  # Backward compatibility alias
        "predicted_fill": float(round(predicted_fill, 2)),  # Backward compatibility alias
        "delta_percent": float(round(predicted_fill - current_fill, 2)),
        "hours_until_overflow": float(round(hours_until_overflow, 2)),
        "predicted_overflow_at": overflow_iso,
        "will_overflow_before": bool(will_overflow),
        "collection_urgency": str(urgency),
        "confidence_lower": float(lower_ci),
        "confidence_upper": float(upper_ci),
        "fill_rate_per_hour": float(round(rate_per_hour, 3)),
        "fill_rate_per_day": float(round(rate_per_hour * 24.0, 2)),
        "r_squared": float(round(r2, 3)),
        "model_formula": "Diurnal-Seasonal OLS Regression: F(t0 + dt) = min(100, F(t0) + r * integral(S(tau) dtau))",
    }


def predict_overflow(db: Session, bin_obj: Bin, use_prophet: bool = False) -> dict:
    """
    Predict when a bin will overflow based on its recent generation trends.
    Used by /predict/{bin_id}, prioritizer, and route optimizer.
    """
    pred_0 = predict_fill_at(db, bin_obj, hours_ahead=0.0)
    return {
        "bin_id": pred_0["bin_id"],
        "bin_name": pred_0["bin_name"],
        "current_fill_percent": pred_0["current_fill_percent"],
        "fill_rate_per_day": pred_0["fill_rate_per_day"],
        "fill_rate_per_hour": pred_0["fill_rate_per_hour"],
        "predicted_overflow_at": pred_0["predicted_overflow_at"],
        "hours_until_overflow": pred_0["hours_until_overflow"],
        "collection_urgency": pred_0["collection_urgency"],
        "r_squared": pred_0.get("r_squared", 0.90),
    }
