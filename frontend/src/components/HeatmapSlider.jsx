/**
 * FillForecastPanel — Predictive fill-level panel.
 * Lets operators select a future horizon (0–72 h) and see exactly
 * how full every bin will be at that time, using Prophet/linear forecasts.
 * Design matches the existing card / stat / badge system.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
} from 'lucide-react';
import api from '../api';

const URGENCY_META = {
  immediate: { label: 'Critical',   color: 'var(--accent-coral)',   bg: 'var(--accent-coral-soft)',   Icon: AlertTriangle },
  soon:      { label: 'Soon',       color: '#f97316',               bg: '#fff7ed',                    Icon: TrendingUp    },
  scheduled: { label: 'Scheduled',  color: 'var(--accent-canary)',  bg: 'var(--accent-canary-soft)',  Icon: Clock         },
  ok:        { label: 'OK',         color: 'var(--accent-emerald)', bg: 'var(--accent-emerald-soft)', Icon: CheckCircle2  },
};

const FILL_COLORS = [
  [80, '#f43f5e'],  // critical ≥80
  [60, '#f97316'],  // warning  ≥60
  [40, '#f59e0b'],  // caution  ≥40
  [0,  '#10b981'],  // ok
];

function getFillColor(pct) {
  for (const [threshold, color] of FILL_COLORS) {
    if (pct >= threshold) return color;
  }
  return '#10b981';
}

function formatShortZone(zone) {
  if (!zone) return 'Zone';
  if (zone.includes('North West')) return 'NW Zone';
  if (zone.includes('South West')) return 'SW Zone';
  if (zone.includes('Central')) return 'Central';
  if (zone.includes('West')) return 'West';
  if (zone.includes('East')) return 'East';
  if (zone.includes('South')) return 'South';
  return zone.split(' ')[0] || zone;
}


function FillBar({ current, predicted }) {
  const curColor  = getFillColor(current);
  const predColor = getFillColor(predicted);
  return (
    <div className="ffp-bar-wrap">
      {/* predicted (background) */}
      <div
        className="ffp-bar-predicted"
        style={{ width: `${Math.min(predicted, 100)}%`, background: `${predColor}30`, borderColor: `${predColor}60` }}
      />
      {/* current (foreground) */}
      <div
        className="ffp-bar-current"
        style={{ width: `${Math.min(current, 100)}%`, background: curColor }}
      />
    </div>
  );
}

function DeltaBadge({ current, predicted }) {
  const delta = predicted - current;
  if (Math.abs(delta) < 0.5) return <span className="ffp-delta ffp-delta-flat"><Minus size={9} />0%</span>;
  if (delta > 0) return (
    <span className="ffp-delta ffp-delta-up">
      <ChevronUp size={10} />+{Math.round(delta)}%
    </span>
  );
  return (
    <span className="ffp-delta ffp-delta-down">
      <ChevronDown size={10} />{Math.round(delta)}%
    </span>
  );
}

export default function FillForecastPanel({ onHeatmapData, onHeatmapModeChange, heatmapMode }) {
  const [hoursAhead, setHoursAhead]   = useState(12);
  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState(null);
  const [error, setError]             = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [predRoutes, setPredRoutes]   = useState(null);
  const [sortKey, setSortKey]         = useState('predicted'); // 'predicted' | 'urgency' | 'name'
  const debounceRef = useRef(null);

  const fetchPredictions = useCallback(async (hours) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setPredRoutes(null);
      try {
        const res = await api.get(`/predict/bulk/all?hours_ahead=${hours}`);
        setData(res.data);
        // Pass heatmap points up to BinMap
        onHeatmapData(
          res.data.predictions.map(p => ({
            lat: p.lat, lng: p.lng,
            intensity: Math.min(1, (p.predicted_fill_percent || 0) / 100),
            bin_id: p.bin_id,
            bin_name: p.bin_name,
            predicted_fill_percent: p.predicted_fill_percent,
            current_fill_percent: p.current_fill_percent,
            hours_until_overflow: p.hours_until_overflow,
            collection_urgency: p.collection_urgency,
            will_overflow_before: p.will_overflow_before,
            zone: p.zone,
            waste_type: p.waste_type,
          })),
          hours
        );
      } catch {
        setError('Forecast unavailable — check backend connection.');
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [onHeatmapData]);

  // Initial load on mount
  useEffect(() => {
    fetchPredictions(hoursAhead);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchPredictions, hoursAhead]);

  const handleSlider = (e) => {
    const h = parseInt(e.target.value, 10);
    setHoursAhead(h);
    fetchPredictions(h);
  };

  const handlePlanRoutes = async () => {
    setRouteLoading(true);
    try {
      const res = await api.get(`/routes/predictive?dispatch_at_hours=${hoursAhead}`);
      setPredRoutes(res.data);
    } catch {
      // silently fail
    } finally {
      setRouteLoading(false);
    }
  };

  // Sorted bin list
  const sortedBins = data ? [...data.predictions].sort((a, b) => {
    if (sortKey === 'predicted') return b.predicted_fill_percent - a.predicted_fill_percent;
    if (sortKey === 'urgency') {
      const order = { immediate: 0, soon: 1, scheduled: 2, ok: 3 };
      return (order[a.collection_urgency] ?? 4) - (order[b.collection_urgency] ?? 4);
    }
    return (a.bin_name || '').localeCompare(b.bin_name || '');
  }) : [];

  const urgency = data?.urgency_summary || {};

  const timeLabel = hoursAhead === 0
    ? 'Right now'
    : hoursAhead < 24
    ? `+${hoursAhead} hours`
    : `+${(hoursAhead / 24).toFixed(1)} days`;

  return (
    <div className="card ffp-card">
      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <div className="card-header">
        <div className="card-header-titles">
          <div className="card-badge badge-blue">AI Forecast</div>
          <h3>Fill Level Prediction</h3>
        </div>
        <div className="ffp-header-actions">
          {loading && (
            <span className="ffp-loading-pill">
              <RefreshCw size={12} className="spin" />
              Computing
            </span>
          )}
          <button
            className={`ffp-heatmap-btn ${heatmapMode ? 'active' : ''}`}
            onClick={() => onHeatmapModeChange(!heatmapMode)}
            title="Overlay predicted fill levels on map"
          >
            <Layers size={13} />
            <span>{heatmapMode ? 'Heatmap Active' : 'Show on Map'}</span>
          </button>
        </div>
      </div>

      {/* ── Card Body ───────────────────────────────────────────────────── */}
      <div className="card-body ffp-body">

        {/* Slider row */}
        <div className="ffp-slider-section">
          <div className="ffp-slider-meta">
            <span className="ffp-slider-label">Forecast horizon</span>
            <span className="ffp-time-chip">
              <Clock size={12} />
              {timeLabel}
            </span>
            {error && <span className="ffp-error-msg">{error}</span>}
          </div>

          <div className="ffp-slider-track-wrap">
            <input
              type="range"
              min={0} max={72} step={1}
              value={hoursAhead}
              onChange={handleSlider}
              className="ffp-range"
            />
            <div className="ffp-tick-row">
              {[0, 6, 12, 24, 36, 48, 72].map(h => (
                <span key={h} className="ffp-tick" style={{ left: `${(h / 72) * 100}%` }}>
                  {h === 0 ? 'Now' : `${h}h`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Urgency summary strip + route button */}
        {data && (
          <div className="ffp-summary-strip">
            <div className="ffp-urgency-row">
              {Object.entries(URGENCY_META).map(([key, meta]) => {
                const count = urgency[key] || 0;
                const { Icon } = meta;
                return (
                  <div key={key} className="ffp-urgency-chip" style={{ background: meta.bg, color: meta.color }}>
                    <Icon size={11} strokeWidth={2.5} />
                    <span className="ffp-chip-count">{count}</span>
                    <span className="ffp-chip-label">{meta.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="ffp-action-row">
              <span className="ffp-overflow-note">
                {data.overflow_within_window} bin{data.overflow_within_window !== 1 ? 's' : ''} overflow within {hoursAhead}h
              </span>
              <button
                className="btn btn-primary ffp-route-btn"
                onClick={handlePlanRoutes}
                disabled={routeLoading || hoursAhead === 0 || loading}
              >
                {routeLoading
                  ? <><RefreshCw size={13} className="spin" /><span>Planning routes…</span></>
                  : <><TrendingUp size={13} /><span>Plan collection for T+{hoursAhead}h</span></>
                }
              </button>
            </div>
          </div>
        )}

        {/* Predictive routes result */}
        {predRoutes && (
          <div className="ffp-pred-routes-bar">
            <span className="ffp-pred-routes-title">
              Predicted routes · T+{predRoutes.hours_ahead}h · {predRoutes.total_bins} bins
            </span>
            <div className="ffp-pred-routes-chips">
              {predRoutes.routes?.map((r, i) => (
                <span key={i} className="ffp-pred-route-chip" style={{ borderColor: ['#2563eb','#8b5cf6','#f59e0b','#06b6d4'][i % 4], color: ['#2563eb','#8b5cf6','#f59e0b','#06b6d4'][i % 4] }}>
                  {r.vehicle_name} · {r.stops?.length} stops · {r.total_distance_km} km
                </span>
              ))}
            </div>
            <span className="ffp-pred-dispatch-time">
              Suggested dispatch: {new Date(predRoutes.dispatch_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Bin forecast table */}
        {sortedBins.length > 0 && (
          <div className="ffp-table-wrap">
            <div className="ffp-table-header">
              <span className="ffp-table-title">
                All {data.total_bins} bins at T+{hoursAhead}h
              </span>
              <div className="ffp-sort-row">
                <span className="ffp-sort-label">Sort:</span>
                {[
                  { key: 'predicted', label: 'Fill %' },
                  { key: 'urgency',   label: 'Urgency' },
                  { key: 'name',      label: 'Name' },
                ].map(s => (
                  <button
                    key={s.key}
                    className={`ffp-sort-btn ${sortKey === s.key ? 'active' : ''}`}
                    onClick={() => setSortKey(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ffp-table">
              {/* Column labels */}
              <div className="ffp-row ffp-row-head">
                <span className="ffp-col-name">Bin</span>
                <span className="ffp-col-zone">Zone</span>
                <span className="ffp-col-now">Now</span>
                <span className="ffp-col-bar"></span>
                <span className="ffp-col-pred">T+{hoursAhead}h</span>
                <span className="ffp-col-delta">Delta</span>
                <span className="ffp-col-overflow">Overflow in</span>
                <span className="ffp-col-urgency">Status</span>
              </div>

              {sortedBins.slice(0, 20).map(bin => {
                const meta  = URGENCY_META[bin.collection_urgency] || URGENCY_META.ok;
                const pct   = Math.round(bin.predicted_fill_percent || 0);
                const cur   = Math.round(bin.current_fill_percent  || 0);
                const predColor = getFillColor(pct);
                const { Icon } = meta;
                return (
                  <div key={bin.bin_id} className="ffp-row">
                    <span className="ffp-col-name ffp-bin-name" title={bin.bin_name}>{bin.bin_name}</span>
                    <span className="ffp-col-zone">
                      <span className="ffp-zone-badge" title={bin.zone}>{formatShortZone(bin.zone)}</span>
                    </span>
                    <span className="ffp-col-now" style={{ color: getFillColor(cur) }}>

                      {cur}%
                    </span>
                    <span className="ffp-col-bar">
                      <FillBar current={cur} predicted={pct} />
                    </span>
                    <span className="ffp-col-pred" style={{ color: predColor, fontWeight: 700 }}>
                      {pct}%
                    </span>
                    <span className="ffp-col-delta">
                      <DeltaBadge current={cur} predicted={pct} />
                    </span>
                    <span className="ffp-col-overflow">
                      {bin.hours_until_overflow != null
                        ? `${bin.hours_until_overflow.toFixed(1)}h`
                        : '—'
                      }
                    </span>
                    <span className="ffp-col-urgency">
                      <span className="ffp-status-pill" style={{ background: meta.bg, color: meta.color }}>
                        <Icon size={10} strokeWidth={2.5} />
                        {meta.label}
                      </span>
                    </span>
                  </div>
                );
              })}

              {sortedBins.length > 20 && (
                <div className="ffp-row ffp-row-more">
                  <span>+{sortedBins.length - 20} more bins not shown</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && (
          <div className="ffp-empty">
            <Clock size={22} strokeWidth={1.5} />
            <span>Drag the slider above to forecast bin fill levels</span>
          </div>
        )}
      </div>
    </div>
  );
}
