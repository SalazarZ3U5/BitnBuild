import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Truck, 
  RefreshCw, 
  Layers,
  MapPin,
  Activity,
  ArrowRight,
  X,
  Route,
  Navigation
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import HeatmapSlider from '../components/HeatmapSlider';

const ROUTE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4', '#10b981'];

export default function ForecastPage() {
  const navigate = useNavigate();
  const [bins, setBins] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapMode, setHeatmapMode] = useState(true);
  const [heatmapHoursAhead, setHeatmapHoursAhead] = useState(6);
  const [plannedRoutes, setPlannedRoutes] = useState(null);
  const [showRouteMap, setShowRouteMap] = useState(false);
  const [routeMapHours, setRouteMapHours] = useState(0);
  const [highlightRouteIndex, setHighlightRouteIndex] = useState(null);

  const fetchBins = useCallback(async () => {
    try {
      const res = await api.get('/bins');
      setBins(res.data || []);
    } catch (err) {
      console.error('Failed to load bins on forecast page:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  // Close route map modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowRouteMap(false);
    };
    if (showRouteMap) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showRouteMap]);

  const handleHeatmapData = useCallback((data, hours) => {
    setHeatmapData(data);
    setHeatmapHoursAhead(hours);
  }, []);

  const handleRoutesPlanned = useCallback((cvrpRoutes, hours) => {
    setPlannedRoutes(cvrpRoutes);
    setRoutes(cvrpRoutes);
    if (cvrpRoutes && cvrpRoutes.length > 0) {
      setRouteMapHours(hours || heatmapHoursAhead);
      setShowRouteMap(true);
    }
  }, [heatmapHoursAhead]);

  // Compute predictive statistics
  const totalPredictedBins = heatmapData.length || bins.length;
  const criticalForecastCount = heatmapData.filter(b => (b.predicted_fill_percent ?? b.fill_percent ?? b.predicted_fill ?? 0) >= 80).length;
  const avgPredictedFill = heatmapData.length > 0 
    ? Math.round(heatmapData.reduce((acc, b) => acc + (b.predicted_fill_percent ?? b.fill_percent ?? b.predicted_fill ?? 0), 0) / heatmapData.length)
    : (bins.length > 0 ? Math.round(bins.reduce((acc, b) => acc + (b.current_fill_percent || 0), 0) / bins.length) : 0);

  return (
    <div className="forecast-page-wrapper">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="header-titles">
          <div className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} style={{ color: '#8b5cf6' }} />
            Neural Predictive AI · Time Horizon Modeling
          </div>
          <h1 className="editorial-title">
            AI Fill Forecast &amp; <em>Proactive</em> Dispatch
          </h1>
          <p className="editorial-subtitle">
            Anticipate sensor fill evolution 1 to 72 hours ahead across all 40 AMC municipal bins. Generate proactive CVRP routes before bins breach emergency thresholds.
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/')}
            title="Return to Dashboard"
          >
            <span>← Back to Dashboard</span>
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => navigate('/fleet')}
            title="Open Live Fleet Tracker"
          >
            <Truck size={15} />
            <span>Open Fleet Tracker</span>
          </button>
        </div>
      </div>

      {/* ── Predictive Horizon HUD KPI Matrix ─────────────────────────────── */}
      <div className="hud-kpi-matrix" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Forecast Horizon */}
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Forecast Horizon</span>
              <div className="kpi-icon-pill icon-dark"><Clock size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">+{heatmapHoursAhead}h</span>
              <span className="kpi-unit">Lookahead</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: `${Math.min((heatmapHoursAhead / 24) * 100, 100)}%`, background: 'linear-gradient(90deg, #38bdf8, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">Linear + <strong>Historical Drift Model</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 2: Projected Critical */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-coral"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag" style={{ color: '#e11d48' }}>Projected Critical</span>
              <div className="kpi-icon-pill icon-coral"><AlertTriangle size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-coral-gradient">{criticalForecastCount}</span>
              <span className="kpi-unit-pill pill-coral">Predicted &gt;80%</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-coral" style={{ width: `${Math.min(criticalForecastCount * 6, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">Require <strong>proactive route reallocation</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 3: Projected Avg Fill */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-amber"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Projected Avg Fill</span>
              <div className="kpi-icon-pill icon-amber"><TrendingUp size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-amber-gradient">{heatmapData.length > 0 || avgPredictedFill > 0 ? `${avgPredictedFill}%` : '--%'}</span>
              <span className="kpi-unit-pill pill-amber">Fleet Avg</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-amber" style={{ width: `${avgPredictedFill || 0}%` }}></div>
              </div>
              <span className="kpi-subtext">Aggregated across <strong>40 smart AMC bins</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 4: Proactive CVRP */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-cyan"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Proactive Routing</span>
              <div className="kpi-icon-pill icon-cyan"><Truck size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-cyan-gradient">{plannedRoutes ? plannedRoutes.length : 'Ready'}</span>
              <span className="kpi-unit-pill pill-cyan">A* Pre-Plan</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-cyan" style={{ width: '100%' }}></div>
              </div>
              <span className="kpi-subtext">Stops sequenced by <strong>predictive urgency</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Predictive Fill Forecast Panel (Full Width) ────────────────────── */}
      <div className="forecast-interactive-panel">
        <HeatmapSlider
          onHeatmapData={handleHeatmapData}
          onHeatmapModeChange={setHeatmapMode}
          heatmapMode={heatmapMode}
          onRoutesPlanned={handleRoutesPlanned}
        />
      </div>

      {/* ── Predictive Geospatial Map Preview ──────────────────────────────── */}
      <div className="card map-card forecast-map-card">
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-blue">Predicted Geospatial Grid (+{heatmapHoursAhead}h Horizon)</div>
            <h3>Projected Overflow Heatmap &amp; Recommended Servicing Stops</h3>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className="pill-counter">
              {criticalForecastCount} Predicted Hotspots
            </span>
          </div>
        </div>
        <div className="card-body no-padding forecast-map-container">
          <BinMap
            bins={bins}
            routes={routes}
            heatmapData={heatmapData}
            heatmapMode={true}
            heatmapHoursAhead={heatmapHoursAhead}
          />
        </div>
      </div>

      {/* ── Route Preview Map Modal ──────────────────────────────────────── */}
      {showRouteMap && plannedRoutes && plannedRoutes.length > 0 && (
        <div className="modal-backdrop" onClick={() => setShowRouteMap(false)}>
          <div 
            className="route-map-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="rmm-header">
              <div className="rmm-header-left">
                <div className="rmm-icon-pod">
                  <Navigation size={20} />
                </div>
                <div className="rmm-header-text">
                  <h3>Predicted Route Map — T+{routeMapHours}h</h3>
                  <span className="rmm-subtitle">
                    {plannedRoutes.length} vehicle{plannedRoutes.length !== 1 ? 's' : ''} · {plannedRoutes.reduce((s, r) => s + (r.stops?.length || 0), 0)} stops · {plannedRoutes.reduce((s, r) => s + parseFloat(r.total_distance_km || 0), 0).toFixed(1)} km total
                  </span>
                </div>
              </div>
              <button className="rmm-close-btn" onClick={() => setShowRouteMap(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            {/* Route Chips */}
            <div className="rmm-route-chips">
              {plannedRoutes.map((r, i) => {
                const chipColor = ROUTE_COLORS[i % ROUTE_COLORS.length];
                const isActive = highlightRouteIndex === i;
                return (
                  <div 
                    key={i} 
                    className={`rmm-chip ${isActive ? 'rmm-chip-active' : ''}`}
                    style={{ 
                      borderColor: chipColor, 
                      color: isActive ? '#fff' : chipColor,
                      background: isActive ? chipColor : '#ffffff',
                      cursor: 'pointer'
                    }}
                    onClick={() => setHighlightRouteIndex(isActive ? null : i)}
                  >
                    <Truck size={12} />
                    <span className="rmm-chip-name">{r.vehicle_name}</span>
                    <span className="rmm-chip-meta">{r.stops?.length} stops · {r.total_distance_km} km</span>
                  </div>
                );
              })}
            </div>

            {/* Map */}
            <div className="rmm-map-container">
              <BinMap
                bins={bins}
                routes={plannedRoutes}
                heatmapData={heatmapData}
                heatmapMode={true}
                heatmapHoursAhead={routeMapHours}
                highlightRouteIndex={highlightRouteIndex}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
