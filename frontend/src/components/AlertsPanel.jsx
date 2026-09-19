function AlertsPanel({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</p>
        <p>No active alerts</p>
      </div>
    );
  }

  const severityIcons = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵',
  };

  return (
    <div className="alerts-list">
      {alerts.map(alert => (
        <div key={alert.id} className={`alert-item ${alert.severity}`}>
          <div className="alert-icon">
            {severityIcons[alert.severity] || '⚪'}
          </div>
          <div className="alert-content">
            <div className="alert-message">{alert.message}</div>
            <div className="alert-meta">
              {alert.zone && `Zone: ${alert.zone}`}
              {alert.alert_type && ` · ${alert.alert_type}`}
              {alert.created_at && ` · ${new Date(alert.created_at).toLocaleString()}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AlertsPanel;
