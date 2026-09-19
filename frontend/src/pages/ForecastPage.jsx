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
  ArrowRight
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import HeatmapSlider from '../components/HeatmapSlider';

export default function ForecastPage() {
  const navigate = useNavigate();
  const [bins, setBins] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapMode, setHeatmapMode] = useState(true);
  const [heatmapHoursAhead, setHeatmapHoursAhead] = useState(6);
  const [plannedRoutes, setPlannedRoutes] = useState(null);

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

  const handleHeatmapData = useCallback((data, hours) => {
    setHeatmapData(data);
    setHeatmapHoursAhead(hours);
  }, []);

  const handleRoutesPlanned = useCallback((cvrpRoutes) => {
    setPlannedRoutes(cvrpRoutes);
    setRoutes(cvrpRoutes);
  }, []);

  // Compute predictive statistics
  const totalPredictedBins = heatmapData.length || bins.length;
  const criticalForecastCount = heatmapData.filter(b => (b.fill_percent || b.predicted_fill || 0) >= 80).length;
  const avgPredictedFill = heatmapData.length > 0 
    ? Math.round(heatmapData.reduce((acc, b) => acc + (b.fill_percent || b.predicted_fill || 0), 0) / heatmapData.length)
    : 0;

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
            <div className="stat-value">{avgPredictedFill || '--'}%</div>
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
    </div>
  );
}
