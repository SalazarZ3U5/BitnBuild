import { useEffect, useRef, useMemo } from 'react';
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
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);
  return null;
}

// Fits map bounds to show all active trucks on initial dispatch
function MultiTruckController({ truckStates, collectionActive }) {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (collectionActive && !hasInitialized.current && truckStates.length > 0) {
      const positions = truckStates
        .filter(t => t.position)
        .map(t => [t.position.lat, t.position.lng]);
      if (positions.length > 0) {
        hasInitialized.current = true;
        map.fitBounds(L.latLngBounds(positions), { padding: [60, 60], maxZoom: 13, duration: 0.8 });
      }
    }
    if (!collectionActive) {
      hasInitialized.current = false;
    }
  }, [truckStates, collectionActive, map]);

  return null;
}

// Individual truck marker with its own color and label
function TruckMarker({ truck }) {
  const icon = useMemo(() => L.divIcon({
    className: 'truck-marker-icon',
    html: `<div class="truck-marker-inner">
      <div class="truck-pulse-ring" style="background: ${truck.color}40; border: 2px solid ${truck.color}"></div>
      <div class="truck-emoji">🚛</div>
      <div class="truck-label-tag" style="background: ${truck.color}">${truck.vehicleName.split(' ').pop()}</div>
    </div>`,
    iconSize: [56, 68],
    iconAnchor: [28, 34],
    popupAnchor: [0, -38],
  }), [truck.color, truck.vehicleName]);

  if (!truck.position || truck.done) return null;

  const currentStop = truck.currentStopIdx >= 0 ? truck.stops[truck.currentStopIdx] : null;

  return (
    <Marker 
      position={[truck.position.lat, truck.position.lng]} 
      icon={icon}
      zIndexOffset={1000 + truck.routeIdx}
    >
      <Popup className="modern-map-popup" autoClose={false} closeOnClick={false}>
        <div className="popup-card truck-collection-popup">
          <div className="popup-header">
            <span className="popup-zone-badge truck-badge" style={{ background: truck.color }}>🚛 {truck.vehicleName}</span>
          </div>
          {currentStop && (
            <>
              <div className="popup-title">{currentStop.bin_name}</div>
              <div className="popup-stat-row">
                <span className="popup-fill-label">Waste This Stop:</span>
                <span className="popup-fill-val" style={{ color: '#10b981' }}>
                  {Math.round(currentStop.fill_percent * 2.4)}L
                </span>
              </div>
            </>
          )}
          <div className="popup-stat-row">
            <span className="popup-fill-label">Total Collected:</span>
            <span className="popup-fill-val" style={{ color: truck.color }}>
              {truck.wasteCollected}L
            </span>
          </div>
          <div className="popup-stat-row">
            <span className="popup-fill-label">Progress:</span>
            <span className="popup-fill-val" style={{ color: '#2563eb' }}>
              {truck.stopsCompleted.length}/{truck.totalStops} stops
            </span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function BinMap({ bins, routes, truckStates = [], collectionActive, totalWasteCollected = 0 }) {
  const center = [23.0225, 72.5714];

  // Derive collected bin names from all trucks
  const collectedBinNames = useMemo(() => {
    const names = new Set();
    truckStates.forEach(t => t.stopsCompleted.forEach(s => names.add(s.binName)));
    return names;
  }, [truckStates]);

  // Currently being collected right now
  const collectingBinNames = useMemo(() => {
    const names = new Set();
    truckStates.forEach(t => {
      if (!t.done && t.currentStopIdx >= 0) {
        names.add(t.stops[t.currentStopIdx]?.bin_name);
      }
    });
    return names;
  }, [truckStates]);

  const totalStopsDone = truckStates.reduce((s, t) => s + t.stopsCompleted.length, 0);

  return (
    <div className="map-container-wrapper">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <MapController />
        <MultiTruckController truckStates={truckStates} collectionActive={collectionActive} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Bin markers */}
        {bins.map(bin => {
          const wasCollected = collectedBinNames.has(bin.name);
          const isBeingCollected = collectingBinNames.has(bin.name);
          // When collected, the bin is emptied to clean residual 5% and guaranteed green (#10b981)
          const fillPercent = wasCollected ? Math.min(bin.current_fill_percent, 5) : bin.current_fill_percent;
          const color = wasCollected ? '#10b981' : getFillColor(fillPercent);

          return (
            <CircleMarker
              key={`${bin.id}-${Math.round(fillPercent)}-${wasCollected ? 'col' : 'uncol'}`}
              center={[bin.lat, bin.lng]}
              radius={isBeingCollected ? 13 : wasCollected ? 9 : 7}
              fillColor={color}
              fillOpacity={wasCollected ? 0.95 : 0.85}
              color={isBeingCollected ? '#2563eb' : wasCollected ? '#059669' : '#ffffff'}
              weight={isBeingCollected ? 3 : wasCollected ? 2.5 : 2}
              opacity={1}
              className={isBeingCollected ? 'bin-collecting-pulse' : ''}
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
                    <span className="popup-fill-val" style={{ color: wasCollected ? '#10b981' : color, fontWeight: 700 }}>
                      {Math.round(fillPercent)}%
                    </span>
                  </div>
                  <div className="popup-progress-track">
                    <div className="popup-progress-fill" style={{ width: `${Math.max(fillPercent, 5)}%`, backgroundColor: color }} />
                  </div>
                  {wasCollected ? (
                    <div className="popup-collected-badge" style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid #10b981',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '11px',
                      marginTop: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ✅ Waste Collected & Emptied (5% residual)
                    </div>
                  ) : isBeingCollected ? (
                    <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '11px', marginTop: '4px' }}>
                      🚛 Servicing bin now...
                    </div>
                  ) : null}
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
          if (route.depot) positions.push([route.depot.lat, route.depot.lng]);
          route.stops
            .sort((a, b) => a.stop_order - b.stop_order)
            .forEach(stop => positions.push([stop.lat, stop.lng]));
          if (route.depot) positions.push([route.depot.lat, route.depot.lng]);

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

        {/* Multiple Animated Truck Markers */}
        {truckStates.map((truck, idx) => (
          <TruckMarker key={`truck-${idx}`} truck={truck} />
        ))}
      </MapContainer>

      {/* Waste Collection Overlay */}
      {collectionActive && totalWasteCollected > 0 && (
        <div className="map-collection-overlay">
          <div className="collection-overlay-stat">
            <span className="overlay-stat-label">Total Collected</span>
            <span className="overlay-stat-value">{totalWasteCollected}L</span>
          </div>
          <div className="collection-overlay-stat">
            <span className="overlay-stat-label">Stops</span>
            <span className="overlay-stat-value">{totalStopsDone}</span>
          </div>
          <div className="collection-overlay-stat">
            <span className="overlay-stat-label">Trucks</span>
            <span className="overlay-stat-value">{truckStates.filter(t => !t.done).length}/{truckStates.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default BinMap;
