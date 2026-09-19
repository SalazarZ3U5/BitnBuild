import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Flame, 
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
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'warning' | 'anomaly'
  const [toastMsg, setToastMsg] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [resolvedIds, setResolvedIds] = useState(new Set());

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
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
      showToast('Incident marked as resolved.');
    } catch {
      // Local optimistic update
      showToast('Incident resolved locally.');
    }
  };

  // Handle Mark All Resolved
  const handleMarkAllResolved = async () => {
    const activeAlerts = alerts.filter(a => a.is_active && !resolvedIds.has(a.id));
    setResolvedIds(new Set(alerts.map(a => a.id)));
    showToast(`All ${activeAlerts.length} notifications marked as resolved.`);
  };

  // Anomaly Injection
  const handleInject = async (scenarioId, label) => {
    setSimLoading(true);
    try {
      const res = await api.post('/simulation/inject-anomaly', { scenario_id: scenarioId });
      showToast(`⚡ ${label} triggered for ${res.data.target_bin}!`);
      await fetchAlerts();
    } catch (err) {
      console.error('Failed to trigger anomaly:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Filtered list
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const isResolved = !a.is_active || resolvedIds.has(a.id);
      if (filter === 'resolved') return isResolved;
      if (isResolved) return false;

      if (filter === 'critical') return a.severity === 'critical';
      if (filter === 'warning') return a.severity === 'warning';
      if (filter === 'anomaly') return a.alert_type !== 'threshold';
      return true; // 'all'
    });
  }, [alerts, filter, resolvedIds]);

  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.is_active && !resolvedIds.has(a.id)).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && a.is_active && !resolvedIds.has(a.id)).length;
  const anomalyCount = alerts.filter(a => a.alert_type !== 'threshold' && a.is_active && !resolvedIds.has(a.id)).length;
  const totalActive = alerts.filter(a => a.is_active && !resolvedIds.has(a.id)).length;

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

      {/* KPI Notification Stats */}
      <div className="stats-grid">
        <div className="stat-card stat-critical">
          <div className="stat-top">
            <span className="stat-tag tag-urgent">Urgent Overflows</span>
            <div className="stat-icon-wrapper icon-critical"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value text-critical">{criticalCount}</div>
            <div className="stat-label">Critical Alerts (&gt;80%)</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend negative">Requires Immediate Fleet Dispatch</span>
          </div>
        </div>

        <div className="stat-card stat-alerts">
          <div className="stat-top">
            <span className="stat-tag">Sensor Anomalies</span>
            <div className="stat-icon-wrapper icon-alerts"><Zap size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{anomalyCount}</div>
            <div className="stat-label">Telemetry Deviations</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">Isolation Forest &amp; Spike Traps</span>
          </div>
        </div>

        <div className="stat-card stat-fill">
          <div className="stat-top">
            <span className="stat-tag">Moderate Warnings</span>
            <div className="stat-icon-wrapper icon-fill"><Clock size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{warningCount}</div>
            <div className="stat-label">Approaching Capacity</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">Scheduled in Next Route Wave</span>
          </div>
        </div>

        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Active Queue</span>
            <div className="stat-icon-wrapper"><Bell size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{totalActive}</div>
            <div className="stat-label">Total Unresolved Incidents</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">● Live Stream Synchronized</span>
          </div>
        </div>
      </div>

      {/* Anomaly Simulation Injection Bar */}
      <div className="notification-sim-strip">
        <div className="n-sim-left">
          <Zap size={15} className="n-sim-icon" />
          <span>Simulate Sensor Event:</span>
        </div>
        <div className="n-sim-buttons">
          <button 
            className="sim-btn sim-anomaly-btn anomaly-surge"
            onClick={() => handleInject('SCENARIO_RAPID_SPIKE', 'Manek Chowk Surge (94.5%)')}
            disabled={simLoading}
          >
            <Zap size={12} />
            <span>Manek Chowk Surge</span>
          </button>
          <button 
            className="sim-btn sim-anomaly-btn anomaly-tilt"
            onClick={() => handleInject('SCENARIO_HIGH_TILT_VANDALISM', 'Riverfront Tilt (47.5°)')}
            disabled={simLoading}
          >
            <AlertTriangle size={12} />
            <span>Riverfront Tilt</span>
          </button>
          <button 
            className="sim-btn sim-anomaly-btn anomaly-fire"
            onClick={() => handleInject('SCENARIO_THERMAL_ANOMALY', 'Law Garden Thermal (64.2°C)')}
            disabled={simLoading}
          >
            <Flame size={12} />
            <span>Thermal Anomaly</span>
          </button>
        </div>
      </div>

      {/* Main Notification Center Card */}
      <div className="card notifications-feed-card">
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-amber">Incident Log Feed</div>
            <h3>Municipal Alert Stream</h3>
          </div>

          {/* Filter Pills */}
          <div className="notification-filter-tabs">
            <button 
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Active ({totalActive})
            </button>
            <button 
              className={`filter-tab ${filter === 'critical' ? 'active' : ''}`}
              onClick={() => setFilter('critical')}
            >
              Critical ({criticalCount})
            </button>
            <button 
              className={`filter-tab ${filter === 'anomaly' ? 'active' : ''}`}
              onClick={() => setFilter('anomaly')}
            >
              Anomalies ({anomalyCount})
            </button>
            <button 
              className={`filter-tab ${filter === 'resolved' ? 'active' : ''}`}
              onClick={() => setFilter('resolved')}
            >
              Resolved ({resolvedIds.size})
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
                const isCritical = alert.severity === 'critical';
                const isResolved = !alert.is_active || resolvedIds.has(alert.id);
                const isAnomaly = alert.alert_type !== 'threshold';

                return (
                  <div 
                    key={alert.id} 
                    className={`notification-item ${isCritical ? 'notif-critical' : isAnomaly ? 'notif-anomaly' : 'notif-warning'} ${isResolved ? 'notif-resolved' : ''}`}
                  >
                    <div className="notif-icon-col">
                      {isResolved ? (
                        <div className="notif-icon-bubble bubble-resolved"><Check size={16} /></div>
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
                        <span className={`notif-severity-pill ${alert.severity}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="notif-zone-badge">{alert.zone || 'AMC Grid'}</span>
                        <span className="notif-type-tag">{alert.alert_type}</span>
                        <span className="notif-time">
                          {alert.created_at ? new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                        </span>
                      </div>

                      <div className="notif-message-text">
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
