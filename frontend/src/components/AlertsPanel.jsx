import { AlertTriangle, AlertOctagon, Info, CheckCircle2, Flame, Crown } from 'lucide-react';

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

  // Pin #1 waste producer / special producer alerts to the very top
  const sortedAlerts = [...alerts].sort((a, b) => {
    const isSpecialA = a.alert_type === 'special_producer' || (a.message && a.message.toLowerCase().includes('#1 waste producer'));
    const isSpecialB = b.alert_type === 'special_producer' || (b.message && b.message.toLowerCase().includes('#1 waste producer'));
    if (isSpecialA && !isSpecialB) return -1;
    if (!isSpecialA && isSpecialB) return 1;
    return 0;
  });

  const renderIcon = (alert) => {
    const isSpecial = alert.alert_type === 'special_producer' || (alert.message && alert.message.toLowerCase().includes('#1 waste producer'));
    if (isSpecial) {
      return <Crown size={18} className="text-special-gold" />;
    }
    switch (alert.severity) {
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
      {sortedAlerts.map(alert => {
        const isSpecial = alert.alert_type === 'special_producer' || (alert.message && alert.message.toLowerCase().includes('#1 waste producer'));

        return (
          <div 
            key={alert.id} 
            className={`alert-card-item severity-${alert.severity} ${isSpecial ? 'alert-special-producer' : ''}`}
          >
            {isSpecial && (
              <div className="alert-special-ribbon">
                <Crown size={12} />
                <span>#1 MUNICIPAL PRODUCER SPECIAL ALERT</span>
              </div>
            )}
            <div className="alert-card-left">
              <div className={`alert-icon-pod pod-${alert.severity} ${isSpecial ? 'pod-special' : ''}`}>
                {renderIcon(alert)}
              </div>
              <div className="alert-card-body">
                <div className="alert-card-title">{alert.message}</div>
                <div className="alert-card-chips">
                  {isSpecial && (
                    <span className="chip-special-tag">👑 Top Waste Hotspot</span>
                  )}
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
            <div className={`alert-severity-pill ${isSpecial ? 'pill-special' : ''}`}>
              {isSpecial ? 'PRIORITY' : alert.severity}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AlertsPanel;
