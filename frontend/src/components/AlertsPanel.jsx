import { AlertTriangle, AlertOctagon, Info, CheckCircle2 } from 'lucide-react';

function AlertsPanel({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="modern-empty-state">
        <div className="empty-state-icon-box empty-success">
          <CheckCircle2 size={28} />
        </div>
        <h4>All Grids Normal</h4>
        <p>No active anomalies or critical overflow thresholds detected.</p>
      </div>
    );
  }

  const renderIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon size={16} className="text-critical" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-warning" />;
      default:
        return <Info size={16} className="text-info" />;
    }
  };

  return (
    <div className="alerts-list-modern">
      {alerts.map(alert => (
        <div key={alert.id} className={`alert-card-item severity-${alert.severity}`}>
          <div className="alert-card-left">
            <div className={`alert-icon-pod pod-${alert.severity}`}>
              {renderIcon(alert.severity)}
            </div>
            <div className="alert-card-body">
              <div className="alert-card-title">{alert.message}</div>
              <div className="alert-card-chips">
                {alert.zone && (
                  <span className="chip-zone">{alert.zone}</span>
                )}
                {alert.alert_type && (
                  <span className="chip-type">{alert.alert_type}</span>
                )}
                {alert.created_at && (
                  <span className="chip-time">
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="alert-severity-pill">
            {alert.severity}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AlertsPanel;
