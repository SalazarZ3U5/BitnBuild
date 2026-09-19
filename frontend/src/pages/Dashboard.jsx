import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import BinMap from '../components/BinMap';
import RoutePanel from '../components/RoutePanel';
import AlertsPanel from '../components/AlertsPanel';
import StatsCharts from '../components/StatsCharts';

function Dashboard() {
  const [bins, setBins] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [binsRes, alertsRes] = await Promise.all([
        api.get('/bins'),
        api.get('/alerts'),
      ]);
      setBins(binsRes.data);
      setAlerts(alertsRes.data);
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
        }
      };
      ws.onclose = () => {
        // Reconnect after 5 seconds
        setTimeout(() => {
          fetchData();
        }, 5000);
      };
    } catch (e) {
      console.warn('WebSocket not available:', e);
    }

    // Refresh every 30 seconds as fallback
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
      <div className="loading">
        <div className="spinner"></div>
        Loading dashboard data...
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Real-time waste bin monitoring and collection management</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card emerald">
          <div className="stat-icon">🗑️</div>
          <div className="stat-value">{totalBins}</div>
          <div className="stat-label">Total Bins</div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{criticalBins}</div>
          <div className="stat-label">Critical (&gt;80%)</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{avgFill}%</div>
          <div className="stat-label">Avg Fill Level</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon">🔔</div>
          <div className="stat-value">{activeAlerts}</div>
          <div className="stat-label">Active Alerts</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">🚛</div>
          <div className="stat-value">{routes.length}</div>
          <div className="stat-label">Routes Today</div>
        </div>
      </div>

      {/* Map + Routes */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>📍 Bin Map</h3>
            <button
              className="btn btn-primary"
              onClick={generateRoutes}
              disabled={routeLoading}
            >
              {routeLoading ? '⏳ Generating...' : '🚛 Generate Routes'}
            </button>
          </div>
          <div className="card-body">
            <BinMap bins={bins} routes={routes} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>🚛 Today's Routes</h3>
          </div>
          <div className="card-body">
            <RoutePanel routes={routes} loading={routeLoading} />
          </div>
        </div>
      </div>

      {/* Alerts + Charts */}
      <div className="dashboard-bottom">
        <div className="card">
          <div className="card-header">
            <h3>🔔 Alerts</h3>
            <span className="route-distance">{activeAlerts} active</span>
          </div>
          <div className="card-body">
            <AlertsPanel alerts={alerts} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>📈 Collection Stats</h3>
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
