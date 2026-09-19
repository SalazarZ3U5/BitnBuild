import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Truck, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  RotateCcw, 
  Play, 
  RefreshCw, 
  Clock, 
  Activity,
  Package,
  ArrowRight,
  Gauge,
  Navigation
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import RoutePanel from '../components/RoutePanel';
import { aStarOptimizeStops } from '../utils/astar';

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
      setRoutes(routesRes.data.routes || []);
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

    const states = optimizedRoutes.map((route, idx) => ({
      routeIdx: idx,
      vehicleName: route.vehicle_name,
      color: TRUCK_COLORS[idx % TRUCK_COLORS.length],
      position: route.depot ? { lat: route.depot.lat, lng: route.depot.lng } : null,
      currentStopIdx: -1,
      totalStops: route.stops.length,
      wasteCollected: 0,
      stopsCompleted: [],
      stops: [...route.stops].sort((a, b) => a.stop_order - b.stop_order),
      done: false,
      astarMetrics: route.astarMetrics,
    }));

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
            return { ...truck, done: true, position: null };
          }

          const stop = truck.stops[nextIdx];
          const waste = Math.round((stop.fill_percent / 100) * 240);
          binsToReset.push(stop.bin_name);

          return {
            ...truck,
            currentStopIdx: nextIdx,
            position: { lat: stop.lat, lng: stop.lng },
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

  const handleResetFleet = () => {
    if (collectionIntervalRef.current) {
      clearInterval(collectionIntervalRef.current);
      collectionIntervalRef.current = null;
    }
    setCollectionActive(false);
    setCollectionComplete(false);
    setTruckStates([]);
    setTotalWasteCollected(0);
    showToast('↺ Fleet returned to depots and collection status reset.');
  };

  const activeTrucks = truckStates.filter(t => !t.done).length;
  const totalStopsDone = truckStates.reduce((s, t) => s + t.stopsCompleted.length, 0);
  const totalPlannedStops = truckStates.reduce((s, t) => s + t.totalStops, 0);

  return (
    <div className="page-container fleet-page-layout">
      {/* Page Header */}
      <div className="page-header-editorial">
        <div className="header-left">
          <div className="header-category-badge">
            <span className="live-dot"></span>
            AMC Municipal Fleet Operations · Live Dispatch Control
          </div>
          <h1 className="editorial-title">
            Smart <em>fleet</em> dispatch &amp; tracking
          </h1>
          <p className="editorial-subtitle">
            A* heuristic pathfinding, real-time multi-truck GPS telemetry, and road-snapped route tracking across Ahmedabad zones.
          </p>
        </div>

        <div className="header-actions">
          <button 
            className="btn btn-primary" 
            onClick={startCollection}
            disabled={collectionActive}
          >
            <Truck size={15} />
            <span>{collectionActive ? 'Fleet Collecting...' : 'Dispatch All 4 Trucks'}</span>
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleGenerateRoutes}
            disabled={routeLoading || collectionActive}
          >
            <RefreshCw size={14} className={routeLoading ? 'spin' : ''} />
            <span>Recompute Routes</span>
          </button>
          <button 
            className="btn btn-secondary btn-icon-only" 
            onClick={handleResetFleet} 
            title="Reset fleet status"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="sim-toast-banner">
          <Sparkles size={14} className="sim-toast-icon" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Fleet KPI Banner */}
      <div className="stats-grid">
        <div className="stat-card stat-routes">
          <div className="stat-top">
            <span className="stat-tag tag-dispatch">Dispatched Vehicles</span>
            <div className="stat-icon-wrapper icon-routes"><Truck size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{routes.length > 0 ? Math.min(routes.length, 4) : 4}</div>
            <div className="stat-label">Active Municipal Trucks</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">● 4 Designated City Hubs</span>
          </div>
        </div>

        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Waste Collected</span>
            <div className="stat-icon-wrapper"><Package size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{totalWasteCollected}L</div>
            <div className="stat-label">Total Volume Loaded</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">Compacted in transit</span>
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

      {/* ── Large Fleet Map & Route Display ────────────────────────────────── */}
      <div className="dashboard-grid fleet-tracking-grid">
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
            />
          </div>
        </div>

        <div className="card route-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-neutral">Vehicle Routes</div>
              <h3>Active Stop Sequences</h3>
            </div>
            {routes.length > 0 && (
              <span className="pill-counter">{routes.length} Vehicles</span>
            )}
          </div>
          <div className="card-body scrollable-card-body">
            <RoutePanel routes={routes} loading={routeLoading} />
          </div>
        </div>
      </div>

      {/* ── Per-Truck Dynamic Status Cards ──────────────────────────────────── */}
      {truckStates.length > 0 && (
        <div className="fleet-truck-status-section">
          <div className="section-title-row">
            <h3>Vehicle Live Telemetry Status</h3>
            <span className="pill-counter">{activeTrucks} Active / {truckStates.length} Dispatched</span>
          </div>

          <div className="truck-widgets-grid">
            {truckStates.map((truck, idx) => (
              <div key={idx} className={`truck-widget ${truck.done ? 'truck-done' : 'truck-active'}`}>
                <div className="truck-widget-header">
                  <div className="truck-widget-name-row">
                    <span className="truck-color-dot" style={{ background: truck.color }}></span>
                    <span className="truck-widget-name">{truck.vehicleName}</span>
                  </div>
                  {truck.done ? (
                    <span className="truck-status-pill done"><CheckCircle2 size={11} /> Complete</span>
                  ) : (
                    <span className="truck-status-pill active">Collecting</span>
                  )}
                </div>

                <div className="truck-widget-body">
                  <div className="tw-stat-row">
                    <div className="tw-stat">
                      <span className="tw-stat-value" style={{ color: truck.color }}>{truck.wasteCollected}L</span>
                      <span className="tw-stat-label">Collected</span>
                    </div>
                    <div className="tw-stat">
                      <span className="tw-stat-value">{truck.stopsCompleted.length}/{truck.totalStops}</span>
                      <span className="tw-stat-label">Stops Done</span>
                    </div>
                  </div>

                  {!truck.done && truck.currentStopIdx >= 0 && (
                    <div className="tw-current-stop">
                      <MapPin size={11} />
                      <span>{truck.stops[truck.currentStopIdx]?.bin_name}</span>
                    </div>
                  )}

                  {truck.astarMetrics && (
                    <div className="tw-astar-badge">
                      <Sparkles size={10} />
                      <span>A* · {truck.astarMetrics.nodesExplored} nodes · {truck.astarMetrics.totalDistance}km</span>
                    </div>
                  )}

                  {/* Stop sequence checklist */}
                  <div className="truck-stop-checklist">
                    {truck.stops.slice(0, 6).map((stop, sIdx) => {
                      const isDone = sIdx <= truck.currentStopIdx;
                      return (
                        <div key={sIdx} className={`checklist-item ${isDone ? 'done' : ''}`}>
                          <span className="chk-idx">{sIdx + 1}</span>
                          <span className="chk-name">{stop.bin_name}</span>
                          {isDone && <CheckCircle2 size={11} className="chk-icon" />}
                        </div>
                      );
                    })}
                    {truck.stops.length > 6 && (
                      <div className="checklist-more">+{truck.stops.length - 6} more stops</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
