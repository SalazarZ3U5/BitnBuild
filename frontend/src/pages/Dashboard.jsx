import { useState, useEffect, useCallback } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  Gauge, 
  Bell, 
  Truck, 
  RefreshCw, 
  ArrowUpRight, 
  Sparkles,
  MapPin,
  Route as RouteIcon,
  Activity,
  Layers
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import RoutePanel from '../components/RoutePanel';
import AlertsPanel from '../components/AlertsPanel';
import StatsCharts from '../components/StatsCharts';

function Dashboard() {
  const [bins, setBins] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [binsRes, alertsRes] = await Promise.all([
        api.get('/bins'),
        api.get('/alerts'),
      ]);
      setBins(binsRes.data);
      setAlerts(alertsRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // WebSocket for real-time updates
    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
      .replace('http', 'ws') + '/ws';

    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'bin_update') {
          setBins(data.bins);
          setLastRefreshed(new Date());
        }
      };
      ws.onclose = () => {
        setTimeout(() => {
          fetchData();
        }, 5000);
      };
    } catch (e) {
      console.warn('WebSocket not available:', e);
    }

    const interval = setInterval(fetchData, 30000);

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [fetchData]);

  const generateRoutes = async () => {
    setRouteLoading(true);
    try {
      const res = await api.get('/routes/today');
      setRoutes(res.data.routes || []);
    } catch (err) {
      console.error('Failed to generate routes:', err);
    } finally {
      setRouteLoading(false);
    }
  };

  // Computed stats
  const totalBins = bins.length;
  const criticalBins = bins.filter(b => b.current_fill_percent > 80).length;
  const avgFill = totalBins > 0
    ? Math.round(bins.reduce((sum, b) => sum + b.current_fill_percent, 0) / totalBins)
    : 0;
  const activeAlerts = alerts.filter(a => a.is_active).length;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="modern-spinner"></div>
        <div className="loading-text">
          <span>Connecting to Ahmedabad (AMC) Fleet Telemetry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Editorial Page Header */}
      <div className="page-header-editorial">
        <div className="header-left">
          <div className="header-category-badge">
            <span className="live-dot"></span>
            AMC Solid Waste Management · Real-Time Smart Grid
          </div>
          <h1 className="editorial-title">
            Modern <em>intelligent</em> AMC waste telemetry
          </h1>
          <p className="editorial-subtitle">
            Automated sensor streaming across Ahmedabad zones, CVRP dynamic fleet dispatch, and predictive anomaly detection.
          </p>
        </div>
        <div className="header-actions">
          <div className="last-sync-badge">
            <Activity size={14} className="sync-icon" />
            <span>Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <button 
            className="btn btn-secondary btn-icon-only" 
            onClick={fetchData} 
            title="Refresh telemetry"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Stats Metric Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Fleet Size</span>
            <div className="stat-icon-wrapper">
              <Trash2 size={18} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{totalBins}</div>
            <div className="stat-label">Monitored Bins</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">● Across 5 AMC City Zones</span>
          </div>
        </div>

        <div className="stat-card stat-critical">
          <div className="stat-top">
            <span className="stat-tag tag-urgent">Urgent Attention</span>
            <div className="stat-icon-wrapper icon-critical">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value text-critical">{criticalBins}</div>
            <div className="stat-label">Critical Overflow (&gt;80%)</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend negative">Requires Immediate Dispatch</span>
          </div>
        </div>

        <div className="stat-card stat-fill">
          <div className="stat-top">
            <span className="stat-tag">Fleet Capacity</span>
            <div className="stat-icon-wrapper icon-fill">
              <Gauge size={18} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{avgFill}%</div>
            <div className="stat-label">Average Fill Rate</div>
          </div>
          <div className="stat-progress-bar">
            <div 
              className="stat-progress-fill" 
              style={{ 
                width: `${avgFill}%`, 
                backgroundColor: avgFill > 70 ? '#f43f5e' : avgFill > 45 ? '#f59e0b' : '#10b981' 
              }}
            ></div>
          </div>
        </div>

        <div className="stat-card stat-alerts">
          <div className="stat-top">
            <span className="stat-tag">Sensor Anomalies</span>
            <div className="stat-icon-wrapper icon-alerts">
              <Bell size={18} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{activeAlerts}</div>
            <div className="stat-label">Active System Alerts</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">Isolation Forest + Spikes</span>
          </div>
        </div>

        <div className="stat-card stat-routes">
          <div className="stat-top">
            <span className="stat-tag tag-dispatch">Optimized Dispatches</span>
            <div className="stat-icon-wrapper icon-routes">
              <Truck size={18} />
            </div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{routes.length}</div>
            <div className="stat-label">Routes Dispatched</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">Google OR-Tools CVRP</span>
          </div>
        </div>
      </div>

      {/* Map + Routes Section */}
      <div className="dashboard-grid">
        <div className="card map-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge">AMC Geospatial Grid</div>
              <h3>Ahmedabad Municipal Smart Bin Network</h3>
            </div>
            <button
              className="btn btn-primary"
              onClick={generateRoutes}
              disabled={routeLoading}
            >
              {routeLoading ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Computing CVRP...</span>
                </>
              ) : (
                <>
                  <Truck size={15} />
                  <span>Generate Optimal Routes</span>
                </>
              )}
            </button>
          </div>
          <div className="card-body no-padding">
            <BinMap bins={bins} routes={routes} />
          </div>
        </div>

        <div className="card route-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-neutral">Fleet Dispatch</div>
              <h3>Active Route Sequence</h3>
            </div>
            {routes.length > 0 && (
              <span className="pill-counter">{routes.length} Vehicles</span>
            )}
          </div>
          <div className="card-body scrollable-card-body">
            <RoutePanel routes={routes} loading={routeLoading} />
          </div>
        </div>
      </div>

      {/* Alerts + Charts Section */}
      <div className="dashboard-bottom">
        <div className="card alerts-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-amber">Incident Log</div>
              <h3>Real-Time Alerts</h3>
            </div>
            <span className="pill-counter pill-warning">{activeAlerts} Active</span>
          </div>
          <div className="card-body scrollable-card-body">
            <AlertsPanel alerts={alerts} />
          </div>
        </div>

        <div className="card charts-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-blue">Fleet Analytics</div>
              <h3>Waste Composition & Levels</h3>
            </div>
          </div>
          <div className="card-body">
            <StatsCharts bins={bins} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
