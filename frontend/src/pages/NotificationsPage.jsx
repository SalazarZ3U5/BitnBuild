import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Zap, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert, 
  Filter, 
  RotateCcw,
  Check,
  Clock,
  MapPin,
  Truck,
  ExternalLink,
  ChevronRight,
  Crown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'warning' | 'anomaly'
  const [toastMsg, setToastMsg] = useState(null);
  const [resolvedIds, setResolvedIds] = useState(new Set());

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/alerts?active_only=false');
      setAlerts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Handle manual alert resolution
  const handleResolveAlert = async (alertId) => {
    setResolvedIds(prev => new Set(prev).add(alertId));
    try {
      await api.patch(`/alerts/${alertId}/resolve`);
      showToast('Incident marked as resolved in AMC database.');
      fetchAlerts();
    } catch {
      showToast('Incident resolved locally.');
    }
  };

  // Handle Mark All Resolved
  const handleMarkAllResolved = async () => {
    try {
      await api.post('/alerts/resolve-all');
      showToast('All active notifications marked as resolved.');
      fetchAlerts();
    } catch {
      setResolvedIds(new Set(alerts.map(a => a.id)));
      showToast('All notifications marked as resolved locally.');
    }
  };

  // Run full anomaly detection scan
  const handleRunDetection = async () => {
    setLoading(true);
    showToast('Running isolation forest anomaly detection scan across all 250 AMC bins...');
    try {
      const res = await api.post('/alerts/detect');
      showToast(`Scan complete: ${res.data.new_alerts} new alert(s) detected.`);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to run detection:', err);
      showToast('Anomaly detection failed. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered list with #1 waste producer / special alerts pinned to top
  const filteredAlerts = useMemo(() => {
    const list = alerts.filter(a => {
      const isResolved = !a.is_active || resolvedIds.has(a.id);
      if (filter === 'resolved') return isResolved;
      if (isResolved) return false;

      if (filter === 'critical') return a.severity === 'critical';
      if (filter === 'warning') return a.severity === 'warning';
      if (filter === 'anomaly') return a.alert_type !== 'threshold';
      return true; // 'all'
    });

    return list.sort((a, b) => {
      const isSpecialA = a.alert_type === 'special_producer' || (a.message && a.message.toLowerCase().includes('#1 waste producer'));
      const isSpecialB = b.alert_type === 'special_producer' || (b.message && b.message.toLowerCase().includes('#1 waste producer'));
      if (isSpecialA && !isSpecialB) return -1;
      if (!isSpecialA && isSpecialB) return 1;
      return 0;
    });
  }, [alerts, filter, resolvedIds]);

  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.is_active && !resolvedIds.has(a.id)).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && a.is_active && !resolvedIds.has(a.id)).length;
  const anomalyCount = alerts.filter(a => a.alert_type !== 'threshold' && a.is_active && !resolvedIds.has(a.id)).length;
  const totalActive = alerts.filter(a => a.is_active && !resolvedIds.has(a.id)).length;
  const resolvedCount = alerts.filter(a => !a.is_active || resolvedIds.has(a.id)).length;

  return (
    <div className="page-container notifications-page-layout">
      {/* Page Header */}
      <div className="page-header-editorial">
        <div className="header-left">
          <div className="header-category-badge">
            <span className="live-dot"></span>
            AMC Central Incident Dispatch · Real-Time Notifications
          </div>
          <h1 className="editorial-title">
            Alerts &amp; <em>incident</em> notifications
          </h1>
          <p className="editorial-subtitle">
            Automated sensor anomaly triage, overflow early-warning notifications, and municipal escalation logs.
          </p>
        </div>

        <div className="header-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleRunDetection} 
            disabled={loading}
            title="Scan all 250 bins for overflows & sensor anomalies"
          >
            <Zap size={14} />
            <span>Run Anomaly Scan</span>
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleMarkAllResolved} 
            disabled={totalActive === 0}
          >
            <Check size={14} />
            <span>Mark All Resolved</span>
          </button>
          <button 
            className="btn btn-secondary btn-icon-only" 
            onClick={fetchAlerts} 
            title="Refresh alerts"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="sim-toast-banner">
          <Bell size={14} className="sim-toast-icon" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* HUD KPI Notification Matrix */}
      <div className="hud-kpi-matrix" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Urgent Overflows */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-coral"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag" style={{ color: '#e11d48' }}>Urgent Overflows</span>
              <div className="kpi-icon-pill icon-coral"><AlertTriangle size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-coral-gradient">{criticalCount}</span>
              <span className="kpi-unit-pill pill-coral">Critical</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-coral" style={{ width: `${Math.min(criticalCount * 20, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">Requires immediate <strong>fleet dispatch</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 2: Sensor Anomalies */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-violet"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Sensor Anomalies</span>
              <div className="kpi-icon-pill icon-violet"><Zap size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-violet-gradient">{anomalyCount}</span>
              <span className="kpi-unit-pill pill-violet">Deviations</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-violet" style={{ width: `${Math.min(anomalyCount * 25, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">Isolation Forest &amp; <strong>spike traps</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 3: Moderate Warnings */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-amber"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Approaching Capacity</span>
              <div className="kpi-icon-pill icon-amber"><Clock size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-amber-gradient">{warningCount}</span>
              <span className="kpi-unit-pill pill-amber">Warning</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-amber" style={{ width: `${Math.min(warningCount * 20, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">Scheduled in <strong>next route wave</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 4: Active Queue */}
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Active Queue</span>
              <div className="kpi-icon-pill icon-dark"><Bell size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">{totalActive}</span>
              <span className="kpi-unit">Incidents</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #38bdf8, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">● Live stream synchronized across <strong>250 nodes</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Notification Center Card */}
      <div className="card notifications-feed-card">
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-amber">Incident Log Feed</div>
            <h3>Municipal Alert Stream</h3>
          </div>

          {/* Filter Tabs */}
          <div className="hud-tab-switcher">
            <button 
              className={`hud-tab-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Active ({totalActive})
            </button>
            <button 
              className={`hud-tab-btn ${filter === 'critical' ? 'active' : ''}`}
              onClick={() => setFilter('critical')}
            >
              Critical ({criticalCount})
            </button>
            <button 
              className={`hud-tab-btn ${filter === 'anomaly' ? 'active' : ''}`}
              onClick={() => setFilter('anomaly')}
            >
              Anomalies ({anomalyCount})
            </button>
            <button 
              className={`hud-tab-btn ${filter === 'resolved' ? 'active' : ''}`}
              onClick={() => setFilter('resolved')}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="notifications-empty-state">
              <RefreshCw size={24} className="spin" />
              <p>Loading incident notifications...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="notifications-empty-state">
              <CheckCircle2 size={36} style={{ color: 'var(--accent-emerald)' }} />
              <h4>All Systems Nominal</h4>
              <p>No active incidents under the selected filter. The municipal grid is running smoothly.</p>
            </div>
          ) : (
            <div className="notifications-list">
              {filteredAlerts.map(alert => {
                const isSpecial = alert.alert_type === 'special_producer' || (alert.message && alert.message.toLowerCase().includes('#1 waste producer'));
                const isCritical = alert.severity === 'critical';
                const isResolved = !alert.is_active || resolvedIds.has(alert.id);
                const isAnomaly = alert.alert_type !== 'threshold' && !isSpecial;

                return (
                  <div 
                    key={alert.id} 
                    className={`notification-item ${isSpecial ? 'notif-special-producer notif-critical' : isCritical ? 'notif-critical' : isAnomaly ? 'notif-anomaly' : 'notif-warning'} ${isResolved ? 'notif-resolved' : ''}`}
                  >
                    <div className="notif-icon-col">
                      {isResolved ? (
                        <div className="notif-icon-bubble bubble-resolved"><Check size={16} /></div>
                      ) : isSpecial ? (
                        <div className="notif-icon-bubble bubble-special" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b' }}><Crown size={16} /></div>
                      ) : isAnomaly ? (
                        <div className="notif-icon-bubble bubble-anomaly"><Zap size={16} /></div>
                      ) : isCritical ? (
                        <div className="notif-icon-bubble bubble-critical"><AlertTriangle size={16} /></div>
                      ) : (
                        <div className="notif-icon-bubble bubble-warning"><Clock size={16} /></div>
                      )}
                    </div>

                    <div className="notif-content-col">
                      <div className="notif-top-row">
                        {isSpecial && (
                          <span className="notif-severity-pill" style={{ background: '#f59e0b', color: '#ffffff', fontWeight: 800 }}>
                            👑 TOP PRODUCER
                          </span>
                        )}
                        <span className={`notif-severity-pill ${alert.severity}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="notif-zone-badge">{alert.zone || 'AMC Grid'}</span>
                        <span className="notif-type-tag">{alert.alert_type}</span>
                        <span className="notif-time">
                          {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                      </div>

                      <div className="notif-message-text" style={{ fontWeight: isSpecial ? 700 : 500 }}>
                        {alert.message}
                      </div>

                      {alert.bin_id && (
                        <div className="notif-meta-row">
                          <span className="notif-bin-id">Bin #{alert.bin_id}</span>
                          <span className="notif-dot">·</span>
                          <span className="notif-subtext">Telemetry logged to AMC PostgreSQL</span>
                        </div>
                      )}
                    </div>

                    <div className="notif-actions-col">
                      {!isResolved && (
                        <>
                          <button 
                            className="notif-btn-dispatch"
                            onClick={() => navigate('/fleet')}
                            title="Open Fleet Tracker to dispatch vehicle"
                          >
                            <Truck size={13} />
                            <span>Dispatch</span>
                          </button>
                          <button 
                            className="notif-btn-resolve"
                            onClick={() => handleResolveAlert(alert.id)}
                            title="Resolve notification"
                          >
                            <Check size={13} />
                            <span>Resolve</span>
                          </button>
                        </>
                      )}
                      {isResolved && (
                        <span className="notif-resolved-label">
                          <CheckCircle2 size={13} /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
