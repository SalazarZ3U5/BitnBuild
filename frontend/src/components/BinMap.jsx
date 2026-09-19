import { useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

// Ahmedabad road bridges across the Sabarmati River
const AHMEDABAD_BRIDGES = [
  [23.0645, 72.5835], // Subhash Bridge
  [23.0410, 72.5732], // Gandhi Bridge
  [23.0282, 72.5715], // Nehru Bridge
  [23.0225, 72.5710], // Ellis Bridge
  [23.0112, 72.5695], // Sardar Bridge
  [22.9960, 72.5645], // Dr. Ambedkar Bridge
];

function getFillColor(fill) {
  if (fill > 80) return '#f43f5e';
  if (fill > 50) return '#f59e0b';
  return '#10b981';
}

function getBinMarkerIcon(bin, fillPercent, wasCollected, isBeingCollected, isBigBin) {
  const color = wasCollected ? '#10b981' : getFillColor(fillPercent);
  const roundedFill = Math.round(fillPercent);

  if (isBigBin) {
    return L.divIcon({
      className: 'bin-div-icon-wrapper',
      html: `
        <div class="big-bin-container ${isBeingCollected ? 'collecting-anim' : ''}">
          <div class="big-bin-halo" style="border-color: ${color}"></div>
          <div class="big-bin-core" style="background: ${color}">
            <span class="big-bin-symbol">🏢</span>
            <span class="big-bin-pct">${wasCollected ? '✓' : roundedFill + '%'}</span>
          </div>
          <div class="big-bin-pill-tag">LDCE 1200L</div>
        </div>
      `,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
      popupAnchor: [0, -34],
    });
  }

  return L.divIcon({
    className: 'bin-div-icon-wrapper',
    html: `
      <div class="standard-bin-pin ${isBeingCollected ? 'collecting-anim' : ''} ${wasCollected ? 'collected' : ''}" style="--marker-color: ${color}">
        <div class="bin-pin-circle" style="background: ${color}; box-shadow: 0 2px 8px ${color}66">
          <span class="bin-pin-val">${wasCollected ? '✓' : roundedFill + '%'}</span>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
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

// Heatmap overlay: canvas-based colored circles showing predicted fill levels
function HeatmapLayer({ heatmapData, hoursAhead = 0 }) {
  const map = useMap();
  const layerRef = useRef(null);

  const getHeatColor = useCallback((intensity) => {
    // Green → Yellow → Orange → Red gradient
    const r = Math.round(intensity < 0.5 ? intensity * 2 * 255 : 255);
    const g = Math.round(intensity < 0.5 ? 255 : (1 - (intensity - 0.5) * 2) * 255);
    return `rgb(${r},${g},30)`;
  }, []);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!heatmapData || heatmapData.length === 0) return;

    const group = L.layerGroup();
    heatmapData.forEach(point => {
      if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number' || isNaN(point.lat) || isNaN(point.lng)) return;
      const intensity = point.intensity || 0;
      const color = getHeatColor(intensity);
      // Small proportional radius: 9px at 0% fill up to 17px at 100% fill (critical)
      const radius = 9 + intensity * 8;
      const circle = L.circleMarker([point.lat, point.lng], {
        radius: radius,
        fillColor: color,
        fillOpacity: 0.75,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.95,
      });
      circle.bindPopup(`
        <div style="font-size:13px;line-height:1.6">
          <strong>${point.bin_name || 'Bin'}</strong><br/>
          <span style="color:#64748b">Zone ${point.zone || '?'} · ${point.waste_type || ''}</span><br/>
          <strong>Now:</strong> ${Math.round(point.current_fill_percent || 0)}%<br/>
          <strong>T+${hoursAhead}h:</strong> <span style="color:${color};font-weight:700">${Math.round(point.predicted_fill_percent || 0)}%</span><br/>
          ${point.hours_until_overflow != null
            ? `<strong>Overflow in:</strong> ${point.hours_until_overflow.toFixed(1)}h`
            : ''}
          <br/><span style="background:${
            {immediate:'#f43f5e',soon:'#f97316',scheduled:'#f59e0b',ok:'#10b981'}[point.collection_urgency]||'#94a3b8'
          }20;color:${
            {immediate:'#f43f5e',soon:'#f97316',scheduled:'#f59e0b',ok:'#10b981'}[point.collection_urgency]||'#94a3b8'
          };padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600">${
            {immediate:'Critical Overflow',soon:'Collection Soon',scheduled:'Scheduled',ok:'Nominal'}[point.collection_urgency]||point.collection_urgency
          }</span>
        </div>
      `, { maxWidth: 200 });
      group.addLayer(circle);
    });


    group.addTo(map);
    layerRef.current = group;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, heatmapData, hoursAhead, getHeatColor]);

  return null;
}


function TruckMarker({ truck }) {
  const label = truck.plateNumber || truck.vehicleName.split(' ').pop();
  const icon = useMemo(() => L.divIcon({
    className: 'truck-marker-icon',
    html: `<div class="truck-marker-inner">
      <div class="truck-pulse-ring" style="background: ${truck.color}40; border: 2px solid ${truck.color}"></div>
      <div class="truck-emoji">🚛</div>
      <div class="truck-label-tag" style="background: ${truck.color}">${label}</div>
    </div>`,
    iconSize: [64, 72],
    iconAnchor: [32, 36],
    popupAnchor: [0, -40],
  }), [truck.color, label]);

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
          <div className="popup-header" style={{ justifyContent: 'space-between' }}>
            <span className="popup-zone-badge truck-badge" style={{ background: truck.color }}>
              🚛 {truck.vehicleName}
            </span>
            {truck.plateNumber && (
              <span className="popup-plate-tag" style={{ border: `1px solid ${truck.color}` }}>
                {truck.plateNumber}
              </span>
            )}
          </div>

          {truck.model && (
            <div className="popup-truck-model-text" style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
              {truck.model}
            </div>
          )}

          {truck.driver && (
            <div className="popup-driver-strip" style={{ background: '#f8fafc', padding: '5px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', margin: '4px 0', fontSize: '0.74rem' }}>
              <div><strong>Driver:</strong> {truck.driver.name} ({truck.driver.empId})</div>
              <div style={{ color: '#64748b', fontSize: '0.7rem' }}>📞 {truck.driver.phone} · {truck.driver.rating}</div>
            </div>
          )}

          {currentStop && (
            <>
              <div className="popup-title" style={{ fontSize: '0.88rem', marginTop: '2px' }}>
                📍 Servicing: {currentStop.bin_name}
              </div>
              <div className="popup-stat-row">
                <span className="popup-fill-label">Bin Fill Level:</span>
                <span className="popup-fill-val" style={{ color: '#10b981', fontSize: '0.9rem' }}>
                  {Math.round(currentStop.fill_percent)}% ({Math.round(currentStop.fill_percent * 2.4)}L)
                </span>
              </div>
            </>
          )}

          <div className="popup-stat-row">
            <span className="popup-fill-label">Total Loaded:</span>
            <span className="popup-fill-val" style={{ color: truck.color, fontSize: '0.9rem' }}>
              {truck.wasteCollected}L / {truck.capacityLiters || 5000}L
            </span>
          </div>

          <div className="popup-stat-row">
            <span className="popup-fill-label">Stops Completed:</span>
            <span className="popup-fill-val" style={{ color: '#2563eb', fontSize: '0.85rem' }}>
              {truck.stopsCompleted.length}/{truck.totalStops} stops
            </span>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function BinMap({ bins, routes, truckStates = [], collectionActive, totalWasteCollected = 0, heatmapData = [], heatmapMode = false, heatmapHoursAhead = 0 }) {
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
        {heatmapMode && heatmapData.length > 0 && (
          <HeatmapLayer heatmapData={heatmapData} hoursAhead={heatmapHoursAhead} />
        )}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* High-visibility Smart Bin Markers with dedicated Big Bin treatment for LDCE */}
        {bins.map(bin => {
          if (!bin || typeof bin.lat !== 'number' || typeof bin.lng !== 'number' || isNaN(bin.lat) || isNaN(bin.lng)) return null;

          const wasCollected = collectedBinNames.has(bin.name);
          const isBeingCollected = collectingBinNames.has(bin.name);
          const fillPercent = wasCollected ? Math.min(bin.current_fill_percent, 5) : (bin.current_fill_percent || 0);
          const color = wasCollected ? '#10b981' : getFillColor(fillPercent);
          const isBigBin = Boolean(
            (bin.capacity_liters && bin.capacity_liters >= 1000) ||
            (bin.name && (bin.name.toLowerCase().includes('ld college') || bin.name.toLowerCase().includes('big bin')))
          );

          const icon = getBinMarkerIcon(bin, fillPercent, wasCollected, isBeingCollected, isBigBin);

          return (
            <Marker
              key={`bin-${bin.id}-${Math.round(fillPercent)}-${wasCollected ? 'col' : 'uncol'}`}
              position={[bin.lat, bin.lng]}
              icon={icon}
              zIndexOffset={isBigBin ? 900 : isBeingCollected ? 600 : 200}
            >
              <Popup className="modern-map-popup">
                <div className="popup-card">
                  <div className="popup-header">
                    <span className="popup-zone-badge">{bin.zone}</span>
                    <span className="popup-waste-tag">{bin.waste_type}</span>
                  </div>
                  {isBigBin && (
                    <div className="popup-big-bin-banner">
                      <span className="big-bin-crown">🏢</span>
                      <span>Campus Mega Dumpster · 1,200L Capacity</span>
                    </div>
                  )}
                  <div className="popup-title">{bin.name}</div>
                  <div className="popup-stat-row">
                    <span className="popup-fill-label">Capacity:</span>
                    <span className="popup-fill-val" style={{ fontSize: '0.85rem', color: isBigBin ? '#f59e0b' : 'inherit' }}>
                      {bin.capacity_liters || 240} Liters {isBigBin ? '(Mega Bin)' : ''}
                    </span>
                  </div>
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
            </Marker>
          );
        })}

        {/* Road-snapped & Bridge-Aware Route Polylines */}
        {routes.map((route, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          let positions = [];

          if (route.geometry && Array.isArray(route.geometry) && route.geometry.length > 1) {
            positions = route.geometry;
          } else {
            // Fallback: build bridge-respecting waypoints so lines NEVER cut across river water
            const waypoints = [];
            if (route.depot) waypoints.push([route.depot.lat, route.depot.lng]);
            route.stops
              .slice()
              .sort((a, b) => a.stop_order - b.stop_order)
              .forEach(stop => waypoints.push([stop.lat, stop.lng]));
            if (route.depot) waypoints.push([route.depot.lat, route.depot.lng]);

            for (let i = 0; i < waypoints.length - 1; i++) {
              const p1 = waypoints[i];
              const p2 = waypoints[i + 1];
              positions.push(p1);

              // If segment crosses the Sabarmati river, insert the closest bridge waypoint
              const crossesRiver = (p1[1] < 72.5715 && p2[1] > 72.5715) ||
                                   (p1[1] > 72.5715 && p2[1] < 72.5715);
              if (crossesRiver) {
                let bestBridge = AHMEDABAD_BRIDGES[2]; // Nehru Bridge
                let minDist = Infinity;
                for (const b of AHMEDABAD_BRIDGES) {
                  const d = Math.hypot(p1[0] - b[0], p1[1] - b[1]) + Math.hypot(b[0] - p2[0], b[1] - p2[1]);
                  if (d < minDist) {
                    minDist = d;
                    bestBridge = b;
                  }
                }
                positions.push(bestBridge);
              }
            }
            if (waypoints.length > 0) {
              positions.push(waypoints[waypoints.length - 1]);
            }
          }

          return (
            <Fragment key={`route-group-${idx}`}>
              {/* Outer soft ambient glow */}
              <Polyline
                positions={positions}
                color={color}
                weight={7}
                opacity={0.3}
              />
              {/* Core road line following street network & bridges */}
              <Polyline
                positions={positions}
                color={color}
                weight={3.5}
                opacity={0.92}
                dashArray={route.geometry ? undefined : "6 4"}
              />
            </Fragment>
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
