import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, Circle, useMap } from 'react-leaflet';
import { Flame, Layers, MapPin, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, X, Sparkles, Truck, Trash } from 'lucide-react';
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

// 5 Authentic Municipal Waste Zones across Ahmedabad with Distinct Area Color Sectors
export const AHMEDABAD_ZONES = [
  {
    id: 'central',
    name: 'Central Zone (Khadia/Riverfront)',
    shortName: 'Central Zone',
    ward: 'Khadia, Bhadra & Old City Wards',
    sectorColor: '#f59e0b', // Vibrant Amber Gold
    sectorTag: 'Heritage & Market Sector',
    centroid: [23.0255, 72.5825],
    polygon: [
      [23.0360, 72.5680],
      [23.0380, 72.5920],
      [23.0310, 72.6060],
      [23.0180, 72.6020],
      [23.0140, 72.5740],
      [23.0250, 72.5670],
    ],
  },
  {
    id: 'west',
    name: 'West Zone (Navrangpura)',
    shortName: 'West Zone',
    ward: 'Navrangpura, Ambawadi & CG Road',
    sectorColor: '#3b82f6', // Royal Cobalt Blue
    sectorTag: 'Commercial & Institutional Sector',
    centroid: [23.0310, 72.5560],
    polygon: [
      [23.0450, 72.5400],
      [23.0450, 72.5680],
      [23.0250, 72.5660],
      [23.0160, 72.5500],
      [23.0220, 72.5380],
      [23.0380, 72.5390],
    ],
  },
  {
    id: 'north_west',
    name: 'North West Zone (Bodakdev)',
    shortName: 'North West Zone',
    ward: 'Bodakdev, SG Highway & Science City',
    sectorColor: '#8b5cf6', // High-Tech Royal Violet
    sectorTag: 'IT & Science City Sector',
    centroid: [23.0510, 72.5160],
    polygon: [
      [23.0850, 72.4950],
      [23.0820, 72.5250],
      [23.0420, 72.5360],
      [23.0320, 72.5280],
      [23.0350, 72.5050],
      [23.0600, 72.4980],
    ],
  },
  {
    id: 'south_west',
    name: 'South West Zone (Satellite)',
    shortName: 'South West Zone',
    ward: 'Satellite, Prahlad Nagar & Sarkhej',
    sectorColor: '#06b6d4', // Vibrant Cyan / Teal
    sectorTag: 'Corporate & Residential Sector',
    centroid: [23.0060, 72.5140],
    polygon: [
      [23.0250, 72.5300],
      [23.0200, 72.5370],
      [23.0020, 72.5320],
      [22.9750, 72.5000],
      [22.9820, 72.4900],
      [23.0120, 72.4980],
    ],
  },
  {
    id: 'east',
    name: 'East Zone (Bapunagar/Nikol)',
    shortName: 'East Zone',
    ward: 'Bapunagar, Nikol & Naroda Wards',
    sectorColor: '#10b981', // Emerald Green
    sectorTag: 'Industrial & Civic Sector',
    centroid: [23.0280, 72.6250],
    polygon: [
      [23.0780, 72.6450],
      [23.0550, 72.6750],
      [23.0350, 72.6700],
      [22.9900, 72.6200],
      [23.0020, 72.5920],
      [23.0350, 72.6080],
    ],
  },
];

function getFillColor(fill) {
  if (fill > 80) return '#f43f5e';
  if (fill > 50) return '#f59e0b';
  return '#10b981';
}

function getBinMarkerIcon(bin, fillPercent, wasCollected, isBeingCollected, isBigBin) {
  const color = wasCollected ? '#10b981' : getFillColor(fillPercent);

  if (isBigBin) {
    return L.divIcon({
      className: 'bin-div-icon-wrapper',
      html: `
        <div class="big-bin-container ${isBeingCollected ? 'collecting-anim' : ''}">
          <div class="big-bin-halo" style="border-color: ${color}"></div>
          <div class="big-bin-core" style="background: ${color}">
            <span class="big-bin-symbol">${wasCollected ? '✓' : (bin?.name?.toLowerCase().includes('manek chowk') ? '👑' : '🏢')}</span>
          </div>
          <div class="big-bin-pill-tag">${bin?.name?.toLowerCase().includes('manek chowk') ? '👑 #1 Hotspot' : 'Hub Bin'}</div>
        </div>
      `,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
      popupAnchor: [0, -28],
    });
  }

  return L.divIcon({
    className: 'bin-div-icon-wrapper',
    html: `
      <div class="standard-bin-pin ${isBeingCollected ? 'collecting-anim' : ''} ${wasCollected ? 'collected' : ''}" style="--marker-color: ${color}">
        <div class="bin-pin-circle" style="background: ${color}; box-shadow: 0 2px 8px ${color}88">
          ${wasCollected ? '<span class="bin-pin-check">✓</span>' : '<span class="bin-pin-dot"></span>'}
        </div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function getHotspotMarkerIcon(bin, fillPercent, tier) {
  const tierColors = {
    critical: '#f43f5e',
    high: '#f97316',
    moderate: '#f59e0b',
    low: '#10b981',
  };
  const color = tierColors[tier] || '#f43f5e';
  return L.divIcon({
    className: 'bin-div-icon-wrapper',
    html: `
      <div class="hotspot-bin-pin">
        <div class="hotspot-ring-outer" style="border-color: ${color}40"></div>
        <div class="hotspot-ring-mid" style="border-color: ${color}80"></div>
        <div class="hotspot-core" style="background: ${color}">
          <span class="hotspot-icon">🔥</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
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


function TruckMarker({ truck, onSelectTruck }) {
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

          {onSelectTruck && (
            <button 
              className="btn btn-primary"
              style={{ marginTop: '10px', width: '100%', padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTruck(truck);
              }}
            >
              <span>Inspect Full Truck Dossier</span>
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

function BinMap({ bins, routes, truckStates = [], collectionActive, totalWasteCollected = 0, heatmapData = [], heatmapMode = false, heatmapHoursAhead = 0, onSelectTruck, hotspotBinIds = new Set(), highlightRouteIndex = null }) {
  const center = [23.0225, 72.5714];
  const [showAreaSectors, setShowAreaSectors] = useState(true);
  const [sectorColorMode, setSectorColorMode] = useState('identity'); // 'identity' (color sectors by region) or 'heat' (color sectors by fill level)

  // Compute live municipal region statistics from current bins telemetry
  const { zoneStats, citywideWasteLiters } = useMemo(() => {
    let citywideWaste = 0;
    const stats = AHMEDABAD_ZONES.map(zone => {
      const zBins = bins.filter(b => {
        if (!b.zone) return false;
        const bz = b.zone.toLowerCase();
        const zs = zone.shortName.toLowerCase();
        const zid = zone.id.toLowerCase();
        return bz.includes(zs) || bz.includes(zid) || (zone.id === 'north_west' && bz.includes('north west')) || (zone.id === 'south_west' && bz.includes('south west'));
      });

      let totalWasteLiters = 0;
      let totalCapacityLiters = 0;
      let criticalCount = 0;
      const streamMap = {};

      zBins.forEach(b => {
        const cap = b.capacity_liters || 240;
        const fill = b.current_fill_percent || 0;
        const liters = (cap * fill) / 100;
        totalWasteLiters += liters;
        totalCapacityLiters += cap;
        if (fill >= 80) criticalCount++;

        const st = b.waste_type || 'General';
        streamMap[st] = (streamMap[st] || 0) + liters;
      });

      citywideWaste += totalWasteLiters;
      const avgFill = totalCapacityLiters > 0 ? (totalWasteLiters / totalCapacityLiters) * 100 : 0;

      let heatColor = '#10b981';
      let heatTier = 'Low Generation';
      let fillOpacity = 0.18;

      if (avgFill >= 58 || totalWasteLiters >= 2200) {
        heatColor = '#f43f5e'; // Crimson Surge Hotspot
        heatTier = 'Critical Surge';
        fillOpacity = 0.32;
      } else if (avgFill >= 46 || totalWasteLiters >= 1600) {
        heatColor = '#f97316'; // Amber / Orange High
        heatTier = 'High Generation';
        fillOpacity = 0.26;
      } else if (avgFill >= 36) {
        heatColor = '#3b82f6'; // Cobalt Moderate
        heatTier = 'Moderate Generation';
        fillOpacity = 0.22;
      }

      return {
        ...zone,
        bins: zBins,
        binCount: zBins.length,
        totalWasteLiters: Math.round(totalWasteLiters),
        totalCapacityLiters: Math.round(totalCapacityLiters),
        avgFill: Math.round(avgFill),
        criticalCount,
        heatColor,
        heatTier,
        fillOpacity,
        streamMap,
      };
    });

    return { zoneStats: stats, citywideWasteLiters: Math.round(citywideWaste) };
  }, [bins]);

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
      {/* Floating Glassmorphic Map View Controls */}
      <div className="map-floating-hud-controls">
        <button
          type="button"
          className={`map-hud-toggle-btn ${showAreaSectors ? 'active' : ''}`}
          onClick={() => setShowAreaSectors(prev => !prev)}
          title="Toggle Municipal Region Color Sectors on the Map"
        >
          <Layers size={13} />
          <span>Area Sectors {showAreaSectors ? 'ON' : 'OFF'}</span>
        </button>

        {showAreaSectors && (
          <div className="map-hud-sub-modes">
            <button
              type="button"
              className={`map-hud-toggle-btn ${sectorColorMode === 'identity' ? 'active' : ''}`}
              onClick={() => setSectorColorMode('identity')}
              title="View Distinct Color Sectors per Municipal Area"
            >
              <span>🎨 Sector Colors</span>
            </button>
            <button
              type="button"
              className={`map-hud-toggle-btn btn-heatmap ${sectorColorMode === 'heat' ? 'active' : ''}`}
              onClick={() => setSectorColorMode('heat')}
              title="View Real-Time Waste Generation Heatmap"
            >
              <Flame size={13} />
              <span>Waste Heatmap</span>
            </button>
          </div>
        )}
      </div>

      {/* Area-wise Municipal Color Sectors Floating Legend */}
      {showAreaSectors && (
        <div className="map-heat-legend">
          <div className="mhl-title">
            {sectorColorMode === 'identity' ? (
              <>
                <Layers size={13} style={{ color: '#3b82f6' }} />
                <span>Municipal Area Color Sectors</span>
              </>
            ) : (
              <>
                <Flame size={13} style={{ color: '#e11d48' }} />
                <span>Waste Generation Heatmap</span>
              </>
            )}
          </div>
          {sectorColorMode === 'identity' ? (
            <div className="mhl-sectors-grid">
              {zoneStats.map(z => (
                <div key={z.id} className="mhl-sector-item">
                  <span className="mhl-dot" style={{ background: z.sectorColor }} />
                  <span className="mhl-sector-name">{z.shortName}</span>
                  <span className="mhl-sector-bins">({z.binCount})</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mhl-stops">
              <div className="mhl-stop"><span className="mhl-dot" style={{ background: '#10b981' }} /> &lt;36% Low</div>
              <div className="mhl-stop"><span className="mhl-dot" style={{ background: '#3b82f6' }} /> 36-46% Mod</div>
              <div className="mhl-stop"><span className="mhl-dot" style={{ background: '#f97316' }} /> 46-58% High</div>
              <div className="mhl-stop"><span className="mhl-dot" style={{ background: '#f43f5e' }} /> &gt;58% Surge</div>
            </div>
          )}
          <div className="mhl-summary">
            5 AMC Municipal Sectors · Total: <strong>{citywideWasteLiters.toLocaleString()} L</strong>
          </div>
        </div>
      )}

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

        {/* Region-wise Municipal Area Color Sectors & Heatmap Overlays (Text ONLY appears on click) */}
        {showAreaSectors && zoneStats.map(zone => {
          const displayColor = sectorColorMode === 'heat' ? zone.heatColor : (zone.sectorColor || '#3b82f6');
          const fillOpacity = sectorColorMode === 'heat' ? zone.fillOpacity : 0.22;

          return (
            <Fragment key={`zone-sector-${zone.id}-${sectorColorMode}`}>
              {/* Region Boundary Area Color Sector Polygon */}
              <Polygon
                positions={zone.polygon}
                pathOptions={{
                  fillColor: displayColor,
                  fillOpacity: fillOpacity,
                  color: displayColor,
                  weight: 2.5,
                  dashArray: '6, 6',
                  className: 'zone-polygon-clickable',
                }}
              >
                <Popup className="zone-heat-popup">
                  <div className="zhp-wrap">
                    <div className="zhp-header">
                      <h4 className="zhp-title">{zone.name}</h4>
                      <span className="zhp-tier-badge" style={{ background: `${displayColor}20`, color: displayColor }}>
                        {sectorColorMode === 'heat' ? zone.heatTier : (zone.sectorTag || 'Municipal Sector')}
                      </span>
                    </div>
                    <div className="zhp-ward">{zone.ward}</div>
                    <div className="zhp-metrics-grid">
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val" style={{ color: displayColor }}>{zone.totalWasteLiters.toLocaleString()} L</span>
                        <span className="zhp-stat-lbl">Waste Volume</span>
                      </div>
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val">{zone.avgFill}%</span>
                        <span className="zhp-stat-lbl">Avg Capacity Fill</span>
                      </div>
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val">{zone.binCount}</span>
                        <span className="zhp-stat-lbl">Monitored Bins</span>
                      </div>
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val" style={{ color: zone.criticalCount > 0 ? '#f43f5e' : '#10b981' }}>
                          {zone.criticalCount}
                        </span>
                        <span className="zhp-stat-lbl">Critical Overflows</span>
                      </div>
                    </div>
                    {Object.keys(zone.streamMap).length > 0 && (
                      <div>
                        <div className="zhp-stream-title">Stream Generation Breakdown</div>
                        <div className="zhp-stream-pills">
                          {Object.entries(zone.streamMap).map(([stream, liters]) => (
                            <span key={stream} className="zhp-stream-pill">
                              {stream}: <strong>{Math.round(liters)}L</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>

              {/* Centroid Color Sector Radiance Core (Also clickable) */}
              <Circle
                center={zone.centroid}
                radius={920}
                pathOptions={{
                  fillColor: displayColor,
                  fillOpacity: 0.12,
                  color: 'transparent',
                  weight: 0,
                  className: 'zone-polygon-clickable',
                }}
              >
                <Popup className="zone-heat-popup">
                  <div className="zhp-wrap">
                    <div className="zhp-header">
                      <h4 className="zhp-title">{zone.name}</h4>
                      <span className="zhp-tier-badge" style={{ background: `${displayColor}20`, color: displayColor }}>
                        {sectorColorMode === 'heat' ? zone.heatTier : (zone.sectorTag || 'Municipal Sector')}
                      </span>
                    </div>
                    <div className="zhp-ward">{zone.ward}</div>
                    <div className="zhp-metrics-grid">
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val" style={{ color: displayColor }}>{zone.totalWasteLiters.toLocaleString()} L</span>
                        <span className="zhp-stat-lbl">Waste Volume</span>
                      </div>
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val">{zone.avgFill}%</span>
                        <span className="zhp-stat-lbl">Avg Capacity Fill</span>
                      </div>
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val">{zone.binCount}</span>
                        <span className="zhp-stat-lbl">Monitored Bins</span>
                      </div>
                      <div className="zhp-stat-box">
                        <span className="zhp-stat-val" style={{ color: zone.criticalCount > 0 ? '#f43f5e' : '#10b981' }}>
                          {zone.criticalCount}
                        </span>
                        <span className="zhp-stat-lbl">Critical Overflows</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Circle>
            </Fragment>
          );
        })}

        {/* High-visibility Smart Bin Markers */}
        {bins.map(bin => {
          if (!bin || typeof bin.lat !== 'number' || typeof bin.lng !== 'number' || isNaN(bin.lat) || isNaN(bin.lng)) return null;

          const wasCollected = collectedBinNames.has(bin.name);
          const isBeingCollected = collectingBinNames.has(bin.name);
          const fillPercent = wasCollected ? Math.min(bin.current_fill_percent, 5) : (bin.current_fill_percent || 0);
          const color = wasCollected ? '#10b981' : getFillColor(fillPercent);
          const isBigBin = Boolean(
            (bin.capacity_liters && bin.capacity_liters >= 1000) ||
            (bin.name && (bin.name.toLowerCase().includes('manek chowk') || bin.name.toLowerCase().includes('big bin')))
          );

          const isHotspot = hotspotBinIds.has(bin.id);
          const hotspotTier = isHotspot && bin._hotspotTier ? bin._hotspotTier : 'critical';
          const icon = isHotspot && !wasCollected
            ? getHotspotMarkerIcon(bin, fillPercent, hotspotTier)
            : getBinMarkerIcon(bin, fillPercent, wasCollected, isBeingCollected, isBigBin);

          return (
            <Marker
              key={`bin-${bin.id}-${Math.round(fillPercent)}-${wasCollected ? 'col' : 'uncol'}-${isHotspot ? 'hot' : 'std'}`}
              position={[bin.lat, bin.lng]}
              icon={icon}
              zIndexOffset={isHotspot ? 1100 : isBigBin ? 900 : isBeingCollected ? 600 : 200}
            >
              <Popup className="modern-map-popup">
                <div className="popup-card">
                  <div className="popup-header">
                    <span className="popup-zone-badge">{bin.zone}</span>
                    <span className="popup-waste-tag">{bin.waste_type}</span>
                  </div>
                  {isBigBin && (
                    <div className="popup-big-bin-banner">
                      <span className="big-bin-crown">👑</span>
                      <span>#1 Municipal Producer · {bin.capacity_liters || 2400}L Mega Dumpster</span>
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

        {routes.map((route, idx) => {
          const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
          const isHighlighted = highlightRouteIndex === null || highlightRouteIndex === idx;
          const glowWeight = isHighlighted ? (highlightRouteIndex === idx ? 12 : 7) : 4;
          const glowOpacity = isHighlighted ? (highlightRouteIndex === idx ? 0.45 : 0.3) : 0.08;
          const coreWeight = isHighlighted ? (highlightRouteIndex === idx ? 5 : 3.5) : 2;
          const coreOpacity = isHighlighted ? (highlightRouteIndex === idx ? 1 : 0.92) : 0.2;
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
                weight={glowWeight}
                opacity={glowOpacity}
              />
              {/* Core road line following street network & bridges */}
              <Polyline
                positions={positions}
                color={color}
                weight={coreWeight}
                opacity={coreOpacity}
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
          <TruckMarker key={`truck-${idx}`} truck={truck} onSelectTruck={onSelectTruck} />
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
