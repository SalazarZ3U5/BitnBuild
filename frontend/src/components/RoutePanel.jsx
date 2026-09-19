import { Truck, MapPin, CheckCircle2, ChevronRight, Navigation } from 'lucide-react';

const ROUTE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4', '#10b981'];

function getFillBadgeClass(fill) {
  if (fill > 80) return 'badge-fill-red';
  if (fill > 50) return 'badge-fill-amber';
  return 'badge-fill-green';
}

function RoutePanel({ routes, loading }) {
  if (loading) {
    return (
      <div className="modern-loading-panel">
        <div className="modern-spinner"></div>
        <p>Solving Capacitated VRP via Google OR-Tools...</p>
      </div>
    );
  }

  if (!routes || routes.length === 0) {
    return (
      <div className="modern-empty-state">
        <div className="empty-state-icon-box">
          <Truck size={32} />
        </div>
        <h4>No Active Dispatches</h4>
        <p>Click "Generate Optimal Routes" to compute vehicle paths based on bin fill urgency.</p>
      </div>
    );
  }

  return (
    <div className="route-panel-modern">
      {routes.map((route, idx) => {
        const themeColor = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        return (
          <div key={idx} className="route-card-item">
            <div className="route-header-strip">
              <div className="route-vehicle-info">
                <div 
                  className="vehicle-color-pill" 
                  style={{ backgroundColor: themeColor }}
                />
                <span className="route-vehicle-name">{route.vehicle_name}</span>
              </div>
              <div className="route-metrics-tag">
                <Navigation size={12} />
                <span>{route.total_distance_km} km</span>
              </div>
            </div>

            <div className="route-stops-timeline">
              {route.stops
                .sort((a, b) => a.stop_order - b.stop_order)
                .map((stop, sIdx) => {
                  const fillVal = stop.fill_percent ?? stop.predicted_fill_percent ?? stop.current_fill_percent ?? 0;
                  const displayFill = isNaN(fillVal) ? 0 : Math.round(fillVal);
                  return (
                    <div key={sIdx} className="route-stop-node">
                      <div className="stop-index-bubble" style={{ borderColor: themeColor }}>
                        {sIdx + 1}
                      </div>
                      <div className="stop-content">
                        <span className="stop-bin-name">{stop.bin_name}</span>
                        <span className={`stop-fill-pill ${getFillBadgeClass(displayFill)}`}>
                          {displayFill}% Fill
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>
        );
      })}
    </div>
  );
}

export default RoutePanel;
