import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue in bundlers
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ROUTE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#10b981'];

function getFillColor(fill) {
  if (fill > 80) return '#ef4444';
  if (fill > 50) return '#f59e0b';
  return '#10b981';
}

function BinMap({ bins, routes }) {
  // Center on Bangalore
  const center = [12.9716, 77.5946];

  return (
    <div className="map-container">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Bin markers */}
        {bins.map(bin => (
          <CircleMarker
            key={bin.id}
            center={[bin.lat, bin.lng]}
            radius={8}
            fillColor={getFillColor(bin.current_fill_percent)}
            fillOpacity={0.85}
            color={getFillColor(bin.current_fill_percent)}
            weight={2}
            opacity={0.6}
          >
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                <strong style={{ fontSize: '0.95rem' }}>{bin.name}</strong>
                <br />
                <span style={{ color: getFillColor(bin.current_fill_percent), fontWeight: 700, fontSize: '1.1rem' }}>
                  {Math.round(bin.current_fill_percent)}%
                </span>
                {' '}filled
                <br />
                <span style={{ color: '#888', fontSize: '0.8rem' }}>
                  Type: {bin.waste_type} · Zone: {bin.zone}
                </span>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Route polylines */}
        {routes.map((route, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          // Build polyline: depot → stops → depot
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
              weight={3}
              opacity={0.8}
              dashArray="8 4"
            />
          );
        })}

        {/* Vehicle depot markers */}
        {routes.map((route, idx) => {
          if (!route.depot) return null;
          return (
            <Marker key={`depot-${idx}`} position={[route.depot.lat, route.depot.lng]}>
              <Popup>
                <strong>🚛 {route.vehicle_name}</strong>
                <br />Depot location
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default BinMap;
