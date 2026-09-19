import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  Gauge, 
  Bell, 
  Truck, 
  RefreshCw, 
  Sparkles,
  MapPin,
  Activity,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Zap,
  Flame,
  CheckCircle2,
  Package
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import RoutePanel from '../components/RoutePanel';
import AlertsPanel from '../components/AlertsPanel';
import StatsCharts from '../components/StatsCharts';
import HeatmapSlider from '../components/HeatmapSlider';
import { aStarOptimizeStops } from '../utils/astar';

const TRUCK_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#06b6d4'];

function Dashboard() {
  const [bins, setBins] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Simulation controls state
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLoading, setSimLoading] = useState(false);
  const [simMessage, setSimMessage] = useState(null);

  // All-critical + multi-truck collection state
  const [allCritical, setAllCritical] = useState(false);
  const [collectionActive, setCollectionActive] = useState(false);
  const [collectionComplete, setCollectionComplete] = useState(false);
  const [totalWasteCollected, setTotalWasteCollected] = useState(0);
  const [truckStates, setTruckStates] = useState([]);

  // ── Heatmap + Predictive Routing state ─────────────────────────────────────
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [heatmapHoursAhead, setHeatmapHoursAhead] = useState(0);


  const hasAutoTriggered = useRef(false);
  const truckStatesRef = useRef([]);
  const collectionActiveRef = useRef(false);
  const collectionIntervalRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { truckStatesRef.current = truckStates; }, [truckStates]);
  useEffect(() => { collectionActiveRef.current = collectionActive; }, [collectionActive]);

  const fetchData = useCallback(async () => {
    // During active collection, skip full bin reload to preserve real-time emptied visual states
    if (collectionActiveRef.current) return;
    try {
      const [binsRes, alertsRes] = await Promise.all([
        api.get('/bins'),
        api.get('/alerts'),
      ]);
      setBins(binsRes.data);
      setAlerts(alertsRes.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSimStatus = useCallback(async () => {
    try {
      const res = await api.get('/simulation/status');
      setSimRunning(res.data.is_running);
      setSimStep(res.data.step_count);
      if (res.data.all_critical) {
        setAllCritical(true);
      }
    } catch (err) {
      console.warn('Simulation status check failed', err);
    }
  }, []);

  const showSimToast = (msg) => {
    setSimMessage(msg);
    setTimeout(() => setSimMessage(null), 5000);
  };

  const toggleSimulation = async () => {
    setSimLoading(true);
    try {
      const nextState = !simRunning;
      await api.post('/simulation/toggle', { enabled: nextState, interval_seconds: 3.0 });
      setSimRunning(nextState);
      if (nextState) {
        setAllCritical(false);
        hasAutoTriggered.current = false;
        setCollectionActive(false);
        setCollectionComplete(false);
        setTruckStates([]);
        setTotalWasteCollected(0);
      }
      showSimToast(nextState ? '▶ Automated telemetry stream started (+1h step every 3s)' : '⏸ Stream paused');
    } catch (err) {
      console.error('Failed to toggle simulation', err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleManualTick = async () => {
    setSimLoading(true);
    try {
      const res = await api.post('/simulation/tick');
      setSimStep(res.data.step_count);
      showSimToast(`⏩ Fleet telemetry advanced +1 step (Step #${res.data.step_count})`);
      await fetchData();
      const statusRes = await api.get('/simulation/status');
      if (statusRes.data.all_critical) {
        setAllCritical(true);
        setSimRunning(false);
      }
    } catch (err) {
      console.error('Failed to advance tick', err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleInjectAnomaly = async (scenarioId, label) => {
    setSimLoading(true);
    try {
      const res = await api.post('/simulation/inject-anomaly', { scenario_id: scenarioId });
      showSimToast(`⚡ ${label} injected for ${res.data.target_bin}!`);
      await fetchData();
    } catch (err) {
      console.error('Failed to inject anomaly', err);
    } finally {
      setSimLoading(false);
    }
  };

  const handleResetSimulation = async () => {
    setSimLoading(true);
    if (collectionIntervalRef.current) {
      clearInterval(collectionIntervalRef.current);
      collectionIntervalRef.current = null;
    }
    try {
      await api.post('/simulation/reset');
      showSimToast('↺ Entire simulation reset: All 40 AMC bins restored to baseline nominal (green <40%). Ready to re-run!');
      setRoutes([]);
      setAllCritical(false);
      hasAutoTriggered.current = false;
      setCollectionActive(false);
      setCollectionComplete(false);
      setTruckStates([]);
      setTotalWasteCollected(0);
      setSimRunning(false);
      setSimStep(0);
      await fetchData();
    } catch (err) {
      console.error('Failed to reset simulation', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Auto-generate routes when all bins hit critical
  const autoGenerateRoutes = useCallback(async () => {
    if (hasAutoTriggered.current) return;
    hasAutoTriggered.current = true;
    
    setRouteLoading(true);
    showSimToast('🚨 All bins critical! Auto-computing 4 CVRP + A* fleet routes covering all 40 bins...');
    
    try {
      const res = await api.get('/routes/today?fill_threshold=50.0');
      const generatedRoutes = res.data.routes || [];
      setRoutes(generatedRoutes);
      if (generatedRoutes.length > 0) {
        showSimToast(`✅ ${generatedRoutes.length} A* optimized fleet routes ready! Click "Dispatch Fleet" to begin collection.`);
      }
    } catch (err) {
      console.error('Failed to auto-generate routes:', err);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allCritical && !hasAutoTriggered.current && !collectionActive && !collectionComplete) {
      autoGenerateRoutes();
    }
  }, [allCritical, autoGenerateRoutes, collectionActive, collectionComplete]);

  // ── Start multi-truck collection with A* optimization ─────────────────────
  const startCollection = useCallback(async () => {
    if (routes.length === 0) return;

    showSimToast('🧠 Running A* pathfinding optimization on all 4 fleet routes...');
    await new Promise(r => setTimeout(r, 600));

    // Support all 4 trucks/paths
    const activeRoutes = routes.slice(0, 4);

    // Apply A* stop ordering to each route starting from its depot
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

    showSimToast(`✅ A* optimized ${optimizedRoutes.length} routes — dispatching fleet!`);

    // Initialize truck states for all vehicles simultaneously
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

  // ── Collection tick — advances ALL trucks simultaneously ──────────────────
  useEffect(() => {
    if (!collectionActive || collectionComplete) return;

    // Initial delay before first movement
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

        // Empty collected bins down to residual 5% (turns them GREEN and reduces fill %)
        if (binsToReset.length > 0) {
          setBins(prev => prev.map(bin => {
            if (binsToReset.includes(bin.name)) {
              return { ...bin, current_fill_percent: 5.0 };
            }
            return bin;
          }));

          // Synchronize with backend database immediately
          api.post('/simulation/empty-bins', { bin_names: binsToReset }).catch(err => {
            console.warn('Backend empty-bins sync failed', err);
          });
        }

        // Update total waste collected
        const total = updated.reduce((sum, t) => sum + t.wasteCollected, 0);
        setTotalWasteCollected(total);

        // Check if all trucks are done
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

  // ── WebSocket + polling ───────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchSimStatus();

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
      .replace('http', 'ws') + '/ws';

    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'bin_update') {
            if (!collectionActiveRef.current) {
              setBins(data.bins);
            }
            setLastRefreshed(new Date());
            const alertsRes = await api.get('/alerts');
            setAlerts(alertsRes.data);
            const statusRes = await api.get('/simulation/status');
            setSimRunning(statusRes.data.is_running);
            setSimStep(statusRes.data.step_count);
            if (statusRes.data.all_critical) {
              setAllCritical(true);
              setSimRunning(false);
            }
          }
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };
      ws.onclose = () => { setTimeout(fetchData, 5000); };
    } catch (e) {
      console.warn('WebSocket not available:', e);
    }

    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, [fetchData, fetchSimStatus]);

  const generateRoutes = async () => {
    setRouteLoading(true);
    try {
      const res = await api.get('/routes/today?fill_threshold=50.0');
      setRoutes(res.data.routes || []);
    } catch (err) {
      console.error('Failed to generate routes:', err);
    } finally {
      setRouteLoading(false);
    }
  };

  // ── Heatmap callbacks ─────────────────────────────────────────────────────
  const handleHeatmapData = useCallback((points, hoursAhead) => {
    setHeatmapData(points);
    setHeatmapHoursAhead(hoursAhead);
  }, []);

  // ── Computed stats ────────────────────────────────────────────────────────

  const totalBins = bins.length;
  const criticalBins = bins.filter(b => b.current_fill_percent > 80).length;
  const moderateBins = bins.filter(b => b.current_fill_percent >= 50 && b.current_fill_percent <= 80).length;
  const nominalBins = bins.filter(b => b.current_fill_percent < 50).length;

  // Exact mathematical average fill percent across all bins
  const avgFill = totalBins > 0
    ? Math.round(bins.reduce((sum, b) => sum + b.current_fill_percent, 0) / totalBins)
    : 0;

  // Percentage of bins currently filled (>= 50% fill level)
  const filledBinsPercent = totalBins > 0
    ? Math.round(((totalBins - nominalBins) / totalBins) * 100)
    : 0;

  // Percentage of bins in critical overflow (> 80%)
  const criticalBinsPercent = totalBins > 0
    ? Math.round((criticalBins / totalBins) * 100)
    : 0;

  const activeAlerts = alerts.filter(a => a.is_active).length;
  const activeTrucks = truckStates.filter(t => !t.done).length;
  const totalStopsDone = truckStates.reduce((s, t) => s + t.stopsCompleted.length, 0);
  const totalPlannedStops = truckStates.reduce((s, t) => s + t.totalStops, 0);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="modern-spinner"></div>
        <div className="loading-text">
          <span>Connecting to Ahmedabad (AMC) Fleet Telemetry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Editorial Page Header */}
      <div className="page-header-editorial">
        <div className="header-left">
          <div className="header-category-badge">
            <span className="live-dot"></span>
            AMC Solid Waste Management · Real-Time Smart Grid
          </div>
          <h1 className="editorial-title">
            Modern <em>intelligent</em> AMC waste telemetry
          </h1>
          <p className="editorial-subtitle">
            Automated sensor streaming across Ahmedabad zones, A* + CVRP dynamic fleet dispatch, and predictive anomaly detection.
          </p>
        </div>
        <div className="header-actions">
          <div className="last-sync-badge">
            <Activity size={14} className="sync-icon" />
            <span>Synced {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <button 
            className="sim-btn-reset-header" 
            onClick={handleResetSimulation} 
            disabled={simLoading}
            title="Reset entire simulation and all 40 bins to nominal"
          >
            <RotateCcw size={14} />
            <span>Reset Sim</span>
          </button>
          <button className="btn btn-secondary btn-icon-only" onClick={fetchData} title="Refresh telemetry">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── All-Critical Dispatch Banner ──────────────────────────────────── */}
      {allCritical && !collectionActive && !collectionComplete && (
        <div className="critical-dispatch-banner">
          <div className="critical-banner-content">
            <div className="critical-banner-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="critical-banner-text">
              <h3>🚨 All Bins Critical — Fleet Dispatch Required</h3>
              <p>All {totalBins} bins exceeded 80% capacity. {Math.min(routes.length, 4)} A*-optimized CVRP routes computed. Dispatch fleet to begin waste collection.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                className="critical-dispatch-btn"
                onClick={startCollection}
                disabled={routes.length === 0 || routeLoading}
              >
                <Truck size={18} />
                <span>{routeLoading ? 'Computing...' : `Dispatch ${Math.min(routes.length, 4)} Trucks`}</span>
              </button>
              <button 
                className="sim-btn sim-btn-reset-main"
                onClick={handleResetSimulation}
                disabled={simLoading}
                style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                title="Reset simulation"
              >
                <RotateCcw size={15} />
                <span>Reset Sim</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-Truck Collection Dashboard ─────────────────────────────── */}
      {collectionActive && truckStates.length > 0 && (
        <div className="collection-dashboard">
          <div className="collection-dash-header">
            <div className="collection-dash-left">
              <div className="collection-truck-icon-anim">
                <Truck size={22} />
              </div>
              <div className="collection-dash-text">
                <h3>🚛 Fleet Collection In Progress</h3>
                <p>A* optimized routes — {activeTrucks} truck{activeTrucks !== 1 ? 's' : ''} active, {totalStopsDone}/{totalPlannedStops || 40} stops completed</p>
              </div>
            </div>
            <div className="collection-banner-stats">
              <div className="collection-stat-item">
                <span className="collection-stat-value">{totalWasteCollected}L</span>
                <span className="collection-stat-label">Total Collected</span>
              </div>
              <div className="collection-stat-divider"></div>
              <div className="collection-stat-item">
                <span className="collection-stat-value">{totalStopsDone}/{totalPlannedStops || 40}</span>
                <span className="collection-stat-label">Stops Done</span>
              </div>
              <div className="collection-stat-divider"></div>
              <div className="collection-stat-item">
                <span className="collection-stat-value" style={{ color: avgFill > 70 ? '#f43f5e' : avgFill > 45 ? '#f59e0b' : '#10b981' }}>{avgFill}%</span>
                <span className="collection-stat-label">Fleet Fill Level</span>
              </div>
              <div className="collection-stat-divider"></div>
              <div className="collection-stat-item">
                <span className="collection-stat-value" style={{ color: criticalBins > 0 ? '#f43f5e' : '#10b981' }}>{criticalBins}</span>
                <span className="collection-stat-label">Remaining Critical</span>
              </div>
              <div className="collection-stat-divider"></div>
              <div className="collection-stat-item">
                <span className="collection-stat-value">{activeTrucks}/{truckStates.length}</span>
                <span className="collection-stat-label">Trucks Active</span>
              </div>
            </div>
          </div>

          {/* Per-Truck Widget Cards */}
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
                      <span className="tw-stat-label">Stops</span>
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Collection Complete Summary ───────────────────────────────────── */}
      {collectionComplete && (
        <div className="collection-complete-banner">
          <div className="collection-complete-header">
            <CheckCircle2 size={24} />
            <h3>Fleet Collection Complete — All Routes Serviced</h3>
          </div>
          <div className="collection-summary-grid">
            <div className="summary-stat-card">
              <Package size={20} />
              <div className="summary-stat-value">{totalWasteCollected}L</div>
              <div className="summary-stat-label">Total Waste Collected</div>
            </div>
            <div className="summary-stat-card">
              <MapPin size={20} />
              <div className="summary-stat-value">{totalStopsDone}</div>
              <div className="summary-stat-label">Bins Serviced</div>
            </div>
            <div className="summary-stat-card">
              <Truck size={20} />
              <div className="summary-stat-value">{truckStates.length}</div>
              <div className="summary-stat-label">Vehicles Dispatched</div>
            </div>
            <div className="summary-stat-card">
              <CheckCircle2 size={20} />
              <div className="summary-stat-value">{avgFill}%</div>
              <div className="summary-stat-label">Avg Fill After</div>
            </div>
          </div>

          {/* Per-Truck Breakdown */}
          <div className="truck-breakdown-section">
            <h4>Per-Vehicle Breakdown</h4>
            <div className="truck-breakdown-grid">
              {truckStates.map((truck, idx) => (
                <div key={idx} className="truck-breakdown-card">
                  <div className="tb-header">
                    <span className="truck-color-dot" style={{ background: truck.color }}></span>
                    <span className="tb-name">{truck.vehicleName}</span>
                    <span className="tb-waste">{truck.wasteCollected}L</span>
                  </div>
                  <div className="tb-stops">
                    {truck.stopsCompleted.map((stop, sIdx) => (
                      <div key={sIdx} className="tb-stop-item">
                        <span className="tb-stop-idx">{sIdx + 1}</span>
                        <span className="tb-stop-name">{stop.binName}</span>
                        <span className="tb-stop-waste">{stop.wasteCollected}L</span>
                      </div>
                    ))}
                  </div>
                  {truck.astarMetrics && (
                    <div className="tb-astar">
                      <Sparkles size={10} />
                      A* optimized · {truck.astarMetrics.totalDistance}km path
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleResetSimulation} style={{ marginTop: '20px', alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.95rem' }}>
            <RotateCcw size={16} />
            <span>↺ Reset Entire Simulation & Re-Run</span>
          </button>
        </div>
      )}

      {/* Sim Control Deck */}
      <div className="sim-control-deck">
        <div className="sim-deck-left">
          <div className="sim-indicator">
            <span className={`sim-pulse-dot ${simRunning ? 'running' : allCritical ? 'critical' : 'idle'}`}></span>
            <div className="sim-status-meta">
              <div className="sim-status-header">
                <span className="sim-status-title">
                  {collectionActive ? `Fleet Dispatched — ${activeTrucks} Trucks Active` : 
                   allCritical ? '⚠ All Bins Critical — Paused' :
                   simRunning ? 'Live Stream Active' : 'Simulation Replay Ready'}
                </span>
                <span className="sim-step-badge">Step #{simStep}</span>
              </div>
              <span className="sim-status-subtitle">
                {collectionActive ? `A* optimized collection — ${totalStopsDone}/${totalPlannedStops || 40} stops completed` :
                 allCritical ? 'Auto-paused: all bins ≥80% capacity' :
                 simRunning ? 'Looping +1h step every 3s' : 'Replay engine idle (tick on demand)'}
              </span>
            </div>
          </div>
          
          <div className="sim-primary-actions">
            <button 
              className={`sim-btn ${simRunning ? 'sim-btn-pause' : 'sim-btn-play'}`}
              onClick={toggleSimulation}
              disabled={simLoading || collectionActive}
              title={simRunning ? "Pause automated stream" : "Start automated stream"}
            >
              {simRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{simRunning ? 'Pause Stream' : 'Live Replay'}</span>
            </button>

            <button 
              className="sim-btn sim-btn-step"
              onClick={handleManualTick}
              disabled={simLoading || simRunning || collectionActive}
              title="Advance telemetry by +1 hour"
            >
              <SkipForward size={14} />
              <span>Step +1h</span>
            </button>

            <button 
              className="sim-btn sim-btn-reset-main"
              onClick={handleResetSimulation}
              disabled={simLoading}
              title="Reset entire simulation and all 40 bins to nominal state"
            >
              <RotateCcw size={14} />
              <span>Reset Sim</span>
            </button>
          </div>
        </div>

        <div className="sim-deck-right">
          <div className="sim-anomaly-wrapper">
            <span className="sim-scenarios-label">Simulate Anomaly:</span>
            <div className="sim-anomaly-group">
              <button className="sim-btn sim-anomaly-btn anomaly-surge"
                onClick={() => handleInjectAnomaly('SCENARIO_RAPID_SPIKE', 'Manek Chowk Surge (94.5%)')}
                disabled={simLoading || collectionActive}>
                <Zap size={13} /><span>Manek Chowk Surge</span>
              </button>
              <button className="sim-btn sim-anomaly-btn anomaly-tilt"
                onClick={() => handleInjectAnomaly('SCENARIO_HIGH_TILT_VANDALISM', 'Riverfront Tilt (47.5°)')}
                disabled={simLoading || collectionActive}>
                <AlertTriangle size={13} /><span>Riverfront Tilt</span>
              </button>
              <button className="sim-btn sim-anomaly-btn anomaly-fire"
                onClick={() => handleInjectAnomaly('SCENARIO_THERMAL_ANOMALY', 'Law Garden Heat (64.2°C)')}
                disabled={simLoading || collectionActive}>
                <Flame size={13} /><span>Thermal Risk</span>
              </button>
              <button className="sim-btn sim-btn-reset"
                onClick={handleResetSimulation}
                disabled={simLoading}>
                <RotateCcw size={13} /><span>Reset Fleet</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {simMessage && (
        <div className="sim-toast-banner">
          <Sparkles size={14} className="sim-toast-icon" />
          <span>{simMessage}</span>
        </div>
      )}

      {/* Stats Metric Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Fleet Size</span>
            <div className="stat-icon-wrapper"><Trash2 size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{totalBins}</div>
            <div className="stat-label">Monitored Bins</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">● Across 5 AMC City Zones</span>
          </div>
        </div>

        <div className="stat-card stat-critical">
          <div className="stat-top">
            <span className="stat-tag tag-urgent">Urgent Attention</span>
            <div className="stat-icon-wrapper icon-critical"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value text-critical">{criticalBins}</div>
            <div className="stat-label">Critical Overflow (&gt;80%)</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend negative">● {criticalBinsPercent}% of Fleet Bins</span>
          </div>
        </div>

        <div className="stat-card stat-fill">
          <div className="stat-top">
            <span className="stat-tag">Fleet Capacity</span>
            <div className="stat-icon-wrapper icon-fill"><Gauge size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{avgFill}%</div>
            <div className="stat-label">Average Fill Rate</div>
          </div>
          <div className="stat-progress-bar">
            <div className="stat-progress-fill" style={{ 
              width: `${avgFill}%`, 
              backgroundColor: avgFill > 70 ? '#f43f5e' : avgFill > 45 ? '#f59e0b' : '#10b981',
              transition: 'width 0.6s ease, background-color 0.6s ease'
            }}></div>
          </div>
          <div className="stat-footer" style={{ marginTop: '8px' }}>
            <span className="stat-trend" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
              {filledBinsPercent}% of bins ≥50% fill
            </span>
          </div>
        </div>

        <div className="stat-card stat-alerts">
          <div className="stat-top">
            <span className="stat-tag">Sensor Anomalies</span>
            <div className="stat-icon-wrapper icon-alerts"><Bell size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{activeAlerts}</div>
            <div className="stat-label">Active System Alerts</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">Isolation Forest + Spikes</span>
          </div>
        </div>

        <div className="stat-card stat-routes">
          <div className="stat-top">
            <span className="stat-tag tag-dispatch">A* Fleet Dispatch</span>
            <div className="stat-icon-wrapper icon-routes"><Truck size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{Math.min(routes.length, 4)}</div>
            <div className="stat-label">Routes Dispatched</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend">4 Zones · A* + CVRP 100% Covered</span>
          </div>
        </div>
      </div>

      {/* ── Predictive Intelligence Strip removed from here, now below map ── */}

      {/* Map + Routes Section */}
      <div className="dashboard-grid">
        <div className="card map-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge">AMC Geospatial Grid</div>
              <h3>Ahmedabad Municipal Smart Bin Network</h3>
            </div>
            <button className="btn btn-primary" onClick={generateRoutes} disabled={routeLoading || collectionActive}>
              {routeLoading ? (
                <><RefreshCw size={15} className="spin" /><span>Computing CVRP...</span></>
              ) : (
                <><Truck size={15} /><span>Generate Optimal Routes</span></>
              )}
            </button>
          </div>
          <div className="card-body no-padding">
            <BinMap
              bins={bins}
              routes={routes}
              truckStates={truckStates}
              collectionActive={collectionActive}
              totalWasteCollected={totalWasteCollected}
              heatmapData={heatmapData}
              heatmapMode={heatmapMode}
              heatmapHoursAhead={heatmapHoursAhead}
            />
          </div>
        </div>

        <div className="card route-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-neutral">Fleet Dispatch</div>
              <h3>Active Route Sequence</h3>
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

      {/* ── Predictive Fill Forecast — full width below map ── */}
      <div className="predictive-below-map">
        <HeatmapSlider
          onHeatmapData={handleHeatmapData}
          onHeatmapModeChange={setHeatmapMode}
          heatmapMode={heatmapMode}
        />
      </div>


      {/* Alerts + Charts Section */}
      <div className="dashboard-bottom">
        <div className="card alerts-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-amber">Incident Log</div>
              <h3>Real-Time Alerts</h3>
            </div>
            <span className="pill-counter pill-warning">{activeAlerts} Active</span>
          </div>
          <div className="card-body scrollable-card-body">
            <AlertsPanel alerts={alerts} />
          </div>
        </div>

        <div className="card charts-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-blue">Fleet Analytics</div>
              <h3>Waste Composition &amp; Levels</h3>
            </div>
          </div>
          <div className="card-body">
            <StatsCharts bins={bins} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
