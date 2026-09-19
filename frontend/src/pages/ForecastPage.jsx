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

      {/* ── Predictive Horizon KPI Bar ─────────────────────────────────────── */}
      <div className="forecast-kpis-grid">
        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Forecast Horizon</span>
            <div className="stat-icon-wrapper"><Clock size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">+{heatmapHoursAhead}h</div>
            <div className="stat-label">Projected Future Time</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">Linear + Historical Drift Model</span>
          </div>
        </div>

        <div className="stat-card stat-critical">
          <div className="stat-top">
            <span className="stat-tag tag-urgent">Projected Critical</span>
            <div className="stat-icon-wrapper icon-critical"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value text-critical">{criticalForecastCount}</div>
            <div className="stat-label">Bins Predicted &gt;80%</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend negative">Require Proactive Routing</span>
          </div>
        </div>

        <div className="stat-card stat-fill">
          <div className="stat-top">
            <span className="stat-tag">Projected Avg Fill</span>
            <div className="stat-icon-wrapper icon-fill"><TrendingUp size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{heatmapData.length > 0 || avgPredictedFill > 0 ? `${avgPredictedFill}%` : '--%'}</div>
            <div className="stat-label">Fleet Capacity in +{heatmapHoursAhead}h</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">Across 40 Monitored AMC Bins</span>
          </div>
        </div>

        <div className="stat-card stat-routes">
          <div className="stat-top">
            <span className="stat-tag tag-dispatch">Proactive CVRP</span>
            <div className="stat-icon-wrapper icon-routes"><Truck size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{plannedRoutes ? plannedRoutes.length : 'Ready'}</div>
            <div className="stat-label">{plannedRoutes ? 'Pre-Dispatched Routes' : 'A* Routes on Demand'}</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">Stops ordered by A* Pathfinding</span>
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
