import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Truck, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  RefreshCw, 
  Activity, 
  Package, 
  Gauge, 
  Navigation,
  User,
  Phone,
  ChevronRight
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import TruckDetailModal from '../components/TruckDetailModal';
import { aStarOptimizeStops } from '../utils/astar';
import { AMC_FLEET, getFleetVehicleMeta } from '../data/fleetData';

const TRUCK_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#06b6d4'];

export default function FleetTrackingPage() {
  const [bins, setBins] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [collectionActive, setCollectionActive] = useState(false);
  const [collectionComplete, setCollectionComplete] = useState(false);
  const [totalWasteCollected, setTotalWasteCollected] = useState(0);
  const [truckStates, setTruckStates] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);

  const truckStatesRef = useRef([]);
  const collectionActiveRef = useRef(false);
  const collectionIntervalRef = useRef(null);

  useEffect(() => { truckStatesRef.current = truckStates; }, [truckStates]);
  useEffect(() => { collectionActiveRef.current = collectionActive; }, [collectionActive]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [binsRes, routesRes] = await Promise.all([
        api.get('/bins'),
        api.get('/routes/today?fill_threshold=50.0').catch(() => ({ data: { routes: [] } }))
      ]);
      setBins(binsRes.data || []);
      const fetchedRoutes = routesRes.data?.routes || [];
      setRoutes(fetchedRoutes);

      setTruckStates(prev => {
        return AMC_FLEET.map((fleetMeta, idx) => {
          const matchingRoute = fetchedRoutes[idx] || null;
          const stops = matchingRoute ? matchingRoute.stops : [];
          const existing = prev[idx] || {};

          return {
            routeIdx: idx,
            vehicleName: fleetMeta.vehicleName,
            plateNumber: fleetMeta.plateNumber,
            model: fleetMeta.model,
            capacityLiters: fleetMeta.capacityLiters,
            fuelType: fleetMeta.fuelType,
            driver: fleetMeta.driver,
            zone: fleetMeta.zone,
            color: fleetMeta.color,
            position: existing.position || (matchingRoute?.depot ? { lat: matchingRoute.depot.lat, lng: matchingRoute.depot.lng } : { lat: fleetMeta.depotCoords[0], lng: fleetMeta.depotCoords[1] }),
            currentStopIdx: existing.currentStopIdx !== undefined ? existing.currentStopIdx : -1,
            totalStops: stops.length || 10,
            wasteCollected: existing.wasteCollected || 0,
            stopsCompleted: existing.stopsCompleted || [],
            stops: stops.length > 0 ? stops : (existing.stops || []),
            done: existing.done || false,
            astarMetrics: matchingRoute?.astarMetrics || existing.astarMetrics || { totalDistance: matchingRoute?.total_distance_km || 13.5, nodesExplored: 10 },
            speed: existing.speed || '0 km/h (Standby)',
            status: existing.status || 'Ready at Depot Hub',
          };
        });
      });
    } catch (err) {
      console.error('Failed to load fleet data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate / recompute A* routes
  const handleGenerateRoutes = async () => {
    setRouteLoading(true);
    showToast('Computing 4 A* + CVRP fleet routes across Ahmedabad...');
    try {
      const res = await api.get('/routes/today?fill_threshold=50.0');
      const newRoutes = res.data.routes || [];
      setRoutes(newRoutes);
      showToast(`✅ ${newRoutes.length} vehicle routes computed and road-snapped.`);
    } catch (err) {
      console.error('Failed to generate routes:', err);
      showToast('Route computation failed. Ensure backend is running.');
    } finally {
      setRouteLoading(false);
    }
  };

  // Dispatch multi-truck collection
  const startCollection = useCallback(async () => {
    if (routes.length === 0) {
      await handleGenerateRoutes();
    }

    showToast('🧠 Running A* pathfinding optimization on all 4 fleet routes...');
    await new Promise(r => setTimeout(r, 600));

    const activeRoutes = routes.slice(0, 4);
    const optimizedRoutes = activeRoutes.map(route => {
      if (!route.depot || route.stops.length <= 1) {
        return { ...route, astarMetrics: { algorithm: 'A* (direct)', nodesExplored: 1, totalDistance: route.total_distance_km || 0 } };
      }
      const sorted = [...route.stops].sort((a, b) => a.stop_order - b.stop_order);
      const result = aStarOptimizeStops(sorted, route.depot);
      return {
        ...route,
        stops: result.stops.map((s, i) => ({ ...s, stop_order: i })),
        astarMetrics: result,
      };
    });

    showToast(`✅ A* optimized ${optimizedRoutes.length} routes — dispatching fleet!`);

    const states = optimizedRoutes.map((route, idx) => {
      const fleetMeta = AMC_FLEET[idx] || getFleetVehicleMeta(idx);
      return {
        routeIdx: idx,
        vehicleName: route.vehicle_name || fleetMeta.vehicleName,
        plateNumber: fleetMeta.plateNumber,
        model: fleetMeta.model,
        capacityLiters: fleetMeta.capacityLiters,
        fuelType: fleetMeta.fuelType,
        driver: fleetMeta.driver,
        zone: fleetMeta.zone,
        color: TRUCK_COLORS[idx % TRUCK_COLORS.length],
        position: route.depot ? { lat: route.depot.lat, lng: route.depot.lng } : { lat: fleetMeta.depotCoords[0], lng: fleetMeta.depotCoords[1] },
        currentStopIdx: -1,
        totalStops: route.stops.length,
        wasteCollected: 0,
        stopsCompleted: [],
        stops: [...route.stops].sort((a, b) => a.stop_order - b.stop_order),
        done: false,
        astarMetrics: route.astarMetrics,
        speed: '28 km/h (Active)',
        status: 'En Route',
      };
    });

    truckStatesRef.current = states;
    setTruckStates(states);
    setCollectionActive(true);
    setCollectionComplete(false);
    setTotalWasteCollected(0);
  }, [routes]);

  // Advance trucks step by step
  useEffect(() => {
    if (!collectionActive || collectionComplete) return;

    const initialDelay = setTimeout(() => {
      const interval = setInterval(() => {
        const current = truckStatesRef.current;
        if (!current.length) return;

        const binsToReset = [];

        const updated = current.map(truck => {
          if (truck.done) return truck;
          const nextIdx = truck.currentStopIdx + 1;

          if (nextIdx >= truck.stops.length) {
            return { 
              ...truck, 
              done: true, 
              speed: '0 km/h (Docked)', 
              status: 'Completed Route — Returned to Depot' 
            };
          }

          const stop = truck.stops[nextIdx];
          const waste = Math.round((stop.fill_percent / 100) * 240);
          binsToReset.push(stop.bin_name);
          const currentSpeed = 22 + Math.floor(Math.random() * 14);

          return {
            ...truck,
            currentStopIdx: nextIdx,
            position: { lat: stop.lat, lng: stop.lng },
            speed: `${currentSpeed} km/h (Navigating)`,
            status: `Servicing Stop #${nextIdx + 1} (${stop.bin_name})`,
            wasteCollected: truck.wasteCollected + waste,
            stopsCompleted: [...truck.stopsCompleted, {
              binName: stop.bin_name,
              wasteCollected: waste,
              vehicleName: truck.vehicleName,
              fillPercent: stop.fill_percent,
            }],
          };
        });

        truckStatesRef.current = updated;
        setTruckStates([...updated]);

        if (binsToReset.length > 0) {
          setBins(prev => prev.map(bin => {
            if (binsToReset.includes(bin.name)) {
              return { ...bin, current_fill_percent: 5.0 };
            }
            return bin;
          }));

          api.post('/simulation/empty-bins', { bin_names: binsToReset }).catch(() => {});
        }

        const total = updated.reduce((sum, t) => sum + t.wasteCollected, 0);
        setTotalWasteCollected(total);

        if (updated.every(t => t.done)) {
          clearInterval(interval);
          collectionIntervalRef.current = null;
          setTimeout(() => {
            setCollectionComplete(true);
            setCollectionActive(false);
          }, 800);
        }
      }, 1800);

      collectionIntervalRef.current = interval;
      return () => {
        clearInterval(interval);
        collectionIntervalRef.current = null;
      };
    }, 1000);

    return () => clearTimeout(initialDelay);
  }, [collectionActive, collectionComplete]);

  const handleReset = () => {
    if (collectionIntervalRef.current) {
      clearInterval(collectionIntervalRef.current);
      collectionIntervalRef.current = null;
    }
    setCollectionActive(false);
    setCollectionComplete(false);
    setTotalWasteCollected(0);
    fetchData();
    showToast('Fleet simulation reset to depot standby.');
  };

  const activeTrucks = truckStates.filter(t => !t.done).length;
  const totalStopsDone = truckStates.reduce((s, t) => s + t.stopsCompleted.length, 0);
  const totalPlannedStops = truckStates.reduce((s, t) => s + t.totalStops, 0);

  return (
    <div className="page-container fleet-tracking-page">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="header-titles">
          <div className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={13} style={{ color: '#2563eb' }} />
            AMC Municipal Fleet Telemetry · Central Command
          </div>
          <h1 className="editorial-title">
            Live Fleet GIS &amp; <em>Telemetry</em> Dispatch
          </h1>
          <p className="editorial-subtitle">
            Real-time GPS positioning, OSRM road-network geometry, river bridge navigation, and automated payload collection telemetry.
          </p>
        </div>

        <div className="header-actions">
          {!collectionActive ? (
            <button 
              className="btn btn-primary" 
              onClick={startCollection}
              disabled={routeLoading}
            >
              <Truck size={16} />
              <span>Dispatch All 4 Trucks</span>
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleReset}>
              <RotateCcw size={15} />
              <span>Reset Fleet</span>
            </button>
          )}

          <button 
            className="btn btn-secondary" 
            onClick={handleGenerateRoutes}
            disabled={routeLoading || collectionActive}
            title="Re-run CVRP optimization"
          >
            {routeLoading ? (
              <><RefreshCw size={15} className="spin" /><span>Computing...</span></>
            ) : (
              <><RefreshCw size={15} /><span>Recompute Routes</span></>
            )}
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="sim-toast-banner">
          <Sparkles size={14} className="sim-toast-icon" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── Fleet KPI Bar ─────────────────────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Active Fleet</span>
            <div className="stat-icon-wrapper"><Truck size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{collectionActive ? activeTrucks : '4 Ready'}</div>
            <div className="stat-label">Commercial Carriers</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">
              ● {collectionActive ? 'En Route across AMC zones' : 'Standby at Depots'}
            </span>
          </div>
        </div>

        <div className="stat-card stat-critical">
          <div className="stat-top">
            <span className="stat-tag tag-urgent">Total Waste Loaded</span>
            <div className="stat-icon-wrapper icon-critical"><Package size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value text-critical">{totalWasteCollected}L</div>
            <div className="stat-label">Payload Compacted</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend negative">Disposed at Pirana Municipal Plant</span>
          </div>
        </div>

        <div className="stat-card stat-fill">
          <div className="stat-top">
            <span className="stat-tag">Service Progress</span>
            <div className="stat-icon-wrapper icon-fill"><Gauge size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{totalStopsDone}/{totalPlannedStops || 40}</div>
            <div className="stat-label">Stops Serviced</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">
              {totalPlannedStops > 0 ? Math.round((totalStopsDone / totalPlannedStops) * 100) : 0}% Route Completion
            </span>
          </div>
        </div>

        <div className="stat-card stat-alerts">
          <div className="stat-top">
            <span className="stat-tag">Navigation Engine</span>
            <div className="stat-icon-wrapper icon-alerts"><Navigation size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">A* + OSRM</div>
            <div className="stat-label">Road Network Geometry</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">River Bridges Respected</span>
          </div>
        </div>
      </div>

      {/* ── Full-Width Map ─────────────────────────────────────────────────── */}
      <div className="card map-card fleet-map-card">
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge">Live Fleet GIS</div>
            <h3>Ahmedabad Municipal Fleet Tracking Map</h3>
          </div>
          {collectionActive && (
            <span className="pill-counter pill-success">
              🚛 {activeTrucks} Trucks Moving Live
            </span>
          )}
        </div>
        <div className="card-body no-padding fleet-map-body">
          <BinMap
            bins={bins}
            routes={routes}
            truckStates={truckStates}
            collectionActive={collectionActive}
            totalWasteCollected={totalWasteCollected}
            onSelectTruck={setSelectedTruck}
          />
        </div>
      </div>

      {/* ── Truck Cards Section ────────────────────────────────────────────── */}
      <div className="fleet-vehicles-section">
        <div className="fleet-section-header">
          <div>
            <div className="card-badge badge-blue" style={{ marginBottom: '6px' }}>
              <Truck size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Real-Time Fleet Telemetry
            </div>
            <h3 className="fleet-section-title">Vehicle-by-Vehicle Status</h3>
          </div>
          <span className={`pill-counter ${collectionActive ? 'pill-success' : ''}`}>
            {collectionActive ? `🚛 ${activeTrucks} Active` : '4 Vehicles Ready'}
          </span>
        </div>

        <div className="fleet-vehicles-grid">
          {truckStates.map((truck, idx) => {
            const isCollecting = collectionActive && !truck.done;
            const progressPct = Math.min(100, Math.round(((truck.wasteCollected || 0) / (truck.capacityLiters || 10000)) * 100));
            const stopProgress = Math.round(((truck.stopsCompleted?.length || 0) / Math.max(truck.totalStops, 1)) * 100);

            return (
              <div 
                key={idx} 
                className={`fleet-vehicle-card status-${truck.done ? 'done' : isCollecting ? 'active' : 'ready'}`}
                onClick={() => setSelectedTruck(truck)}
                title="Click to view comprehensive vehicle dossier & telemetry"
              >
                {/* Color accent bar */}
                <div className="fvc-accent-bar" style={{ background: truck.color }} />

                <div className="fvc-body">
                  {/* Top: Plate + Status */}
                  <div className="fvc-top-row">
                    <div className="tdc-plate-badge" title="Municipal Vehicle Plate Registration">
                      <span className="plate-ind">IND</span>
                      <span>{truck.plateNumber}</span>
                    </div>
                    <div className={`tdc-status-pill ${truck.done ? 'done' : isCollecting ? 'active' : 'ready'}`}>
                      {isCollecting && <span className="live-ping-dot" />}
                      <span>{truck.done ? 'Complete' : isCollecting ? 'En Route' : 'Standby'}</span>
                    </div>
                  </div>

                  {/* Vehicle Identity */}
                  <div className="fvc-identity">
                    <div className="fvc-name-row">
                      <span className="fvc-color-dot" style={{ background: truck.color }} />
                      <span className="fvc-vehicle-name">{truck.vehicleName}</span>
                      <span className="fvc-zone-tag">{truck.zone}</span>
                    </div>
                    <div className="fvc-model">
                      <Truck size={12} />
                      <span>{truck.model}</span>
                    </div>
                  </div>

                  {/* Driver */}
                  <div className="fvc-driver-row">
                    <div className="fvc-driver-avatar">
                      <User size={13} />
                    </div>
                    <div className="fvc-driver-info">
                      <span className="fvc-driver-name">{truck.driver?.name}</span>
                      <span className="fvc-driver-sub">ID: {truck.driver?.empId || truck.driver?.id}</span>
                    </div>
                    <a 
                      href={`tel:${truck.driver?.phone}`} 
                      className="fvc-call-btn"
                      title={`Call ${truck.driver?.name}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone size={12} />
                    </a>
                  </div>

                  {/* Telemetry Row */}
                  <div className="fvc-telemetry-row">
                    <div className="fvc-telem-item">
                      <span className="fvc-telem-label">Speed</span>
                      <span className="fvc-telem-val">{isCollecting ? truck.speed?.split(' ')[0] || '26 km/h' : '0 km/h'}</span>
                    </div>
                    <div className="fvc-telem-divider" />
                    <div className="fvc-telem-item">
                      <span className="fvc-telem-label">Stops</span>
                      <span className="fvc-telem-val">{truck.stopsCompleted?.length || 0}<span style={{ fontWeight: 400, opacity: 0.6 }}>/{truck.totalStops}</span></span>
                    </div>
                    <div className="fvc-telem-divider" />
                    <div className="fvc-telem-item">
                      <span className="fvc-telem-label">Loaded</span>
                      <span className="fvc-telem-val" style={{ color: truck.color }}>{truck.wasteCollected || 0}L</span>
                    </div>
                  </div>

                  {/* Current destination */}
                  {!truck.done && truck.currentStopIdx >= 0 && truck.stops[truck.currentStopIdx] && (
                    <div className="fvc-current-stop">
                      <MapPin size={11} />
                      <span>{truck.stops[truck.currentStopIdx].bin_name}</span>
                    </div>
                  )}

                  {/* Progress bars */}
                  <div className="fvc-progress-section">
                    <div className="fvc-progress-label">
                      <span>Route Progress</span>
                      <span>{stopProgress}%</span>
                    </div>
                    <div className="fvc-progress-track">
                      <div 
                        className="fvc-progress-fill"
                        style={{ 
                          width: `${stopProgress}%`,
                          background: truck.done ? '#10b981' : truck.color,
                        }}
                      />
                    </div>
                  </div>

                  {/* A* badge + view dossier */}
                  <div className="fvc-footer">
                    {truck.astarMetrics && (
                      <div className="fvc-astar-badge">
                        <Sparkles size={10} />
                        <span>A* · {truck.astarMetrics.totalDistance || 12.5}km</span>
                      </div>
                    )}
                    <button 
                      className="fvc-dossier-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTruck(truck);
                      }}
                    >
                      <span>Full Dossier</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Comprehensive Truck Information Popup Modal ── */}
      {selectedTruck && (
        <TruckDetailModal 
          truck={selectedTruck} 
          onClose={() => setSelectedTruck(null)} 
        />
      )}
    </div>
  );
}
