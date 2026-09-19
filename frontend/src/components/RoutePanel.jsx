const ROUTE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#10b981'];

function getFillClass(fill) {
  if (fill > 80) return 'fill-red';
  if (fill > 50) return 'fill-yellow';
  return 'fill-green';
}

function RoutePanel({ routes, loading }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        Optimizing routes...
      </div>
    );
  }

  if (!routes || routes.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚛</p>
        <p>No routes generated yet.</p>
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Click "Generate Routes" to create optimized collection routes
        </p>
      </div>
    );
  }

  return (
    <div className="route-panel">
      {routes.map((route, idx) => (
        <div key={idx} className="route-item">
          <div className="route-vehicle">
            <div className="route-vehicle-name">
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: ROUTE_COLORS[idx % ROUTE_COLORS.length],
                marginRight: 4,
              }} />
              🚛 {route.vehicle_name}
            </div>
            <div className="route-distance">
              {route.total_distance_km} km
            </div>
          </div>
          <ul className="route-stops">
            {route.stops
              .sort((a, b) => a.stop_order - b.stop_order)
              .map((stop, sIdx) => (
                <li key={sIdx} className="route-stop">
                  <span
                    className="route-stop-number"
                    style={{ background: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                  >
                    {sIdx + 1}
                  </span>
                  <span>{stop.bin_name}</span>
                  <span className={`route-stop-fill ${getFillClass(stop.fill_percent)}`}>
                    {Math.round(stop.fill_percent)}%
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default RoutePanel;
