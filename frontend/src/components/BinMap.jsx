import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ROUTE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#f43f5e', '#06b6d4', '#10b981'];

function getFillColor(fill) {
  if (fill > 80) return '#f43f5e';
  if (fill > 50) return '#f59e0b';
  return '#10b981';
}

// Controller to fix Leaflet grey tile / size calculation bugs
function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);
  return null;
}

function BinMap({ bins, routes }) {
  // Center on Ahmedabad (AMC Municipal Region)
  const center = [23.0225, 72.5714];

  return (
    <div className="map-container-wrapper">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapController />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Bin markers */}
        {bins.map(bin => {
          const color = getFillColor(bin.current_fill_percent);
          return (
            <CircleMarker
              key={bin.id}
              center={[bin.lat, bin.lng]}
              radius={7}
              fillColor={color}
              fillOpacity={0.9}
              color="#ffffff"
              weight={2}
              opacity={1}
            >
              <Popup className="modern-map-popup">
                <div className="popup-card">
                  <div className="popup-header">
                    <span className="popup-zone-badge">{bin.zone}</span>
                    <span className="popup-waste-tag">{bin.waste_type}</span>
                  </div>
                  <div className="popup-title">{bin.name}</div>
                  <div className="popup-stat-row">
                    <span className="popup-fill-label">Fill Level:</span>
                    <span className="popup-fill-val" style={{ color: color }}>
                      {Math.round(bin.current_fill_percent)}%
                    </span>
                  </div>
                  <div className="popup-progress-track">
                    <div 
                      className="popup-progress-fill" 
                      style={{ width: `${bin.current_fill_percent}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="popup-coordinates">
                    {bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Route polylines */}
        {routes.map((route, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const positions = [];
          if (route.depot) {
            positions.push([route.depot.lat, route.depot.lng]);
          }
          route.stops
            .sort((a, b) => a.stop_order - b.stop_order)
            .forEach(stop => {
              positions.push([stop.lat, stop.lng]);
            });
          if (route.depot) {
            positions.push([route.depot.lat, route.depot.lng]);
          }

          return (
            <Polyline
              key={`route-${idx}`}
              positions={positions}
              color={color}
              weight={4}
              opacity={0.85}
              dashArray="6 4"
            />
          );
        })}

        {/* Vehicle depot markers */}
        {routes.map((route, idx) => {
          if (!route.depot) return null;
          return (
            <Marker key={`depot-${idx}`} position={[route.depot.lat, route.depot.lng]}>
              <Popup className="modern-map-popup">
                <div className="popup-card">
                  <div className="popup-header">
                    <span className="popup-zone-badge">Depot Hub</span>
                  </div>
                  <div className="popup-title">🚛 {route.vehicle_name}</div>
                  <div className="popup-stat-row">
                    <span>Assigned Stops:</span>
                    <strong>{route.stops.length} Bins</strong>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default BinMap;
