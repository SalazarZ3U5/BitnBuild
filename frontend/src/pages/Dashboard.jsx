import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Package,
  ExternalLink,
  ChevronRight,
  Phone,
  User,
  Navigation,
  Fuel,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Crown
} from 'lucide-react';
import api from '../api';
import BinMap from '../components/BinMap';
import StatsCharts from '../components/StatsCharts';
import TruckDetailModal from '../components/TruckDetailModal';
import { useFleet } from '../context/FleetContext';
import { DEFAULT_BINS } from '../data/defaultBins';

const TRUCK_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b', '#06b6d4'];

function Dashboard() {
  const navigate = useNavigate();
  const {
    routes,
    setRoutes,
    routeLoading,
    truckStates,
    collectionActive,
    collectionComplete,
    totalWasteCollected,
    startCollection,
    resetFleet,
    fetchFleetRoutes,
    selectedTruck,
    setSelectedTruck,
    activeTrucks,
    totalStopsDone,
    totalPlannedStops,
  } = useFleet();

  const [bins, setBins] = useState(() => {
    try {
      const cached = localStorage.getItem('amc_bins_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_BINS;
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Special Top Producer Alert
  const specialTopAlert = useMemo(() => {
    return alerts.find(a => a.is_active && (a.alert_type === 'special_producer' || (a.message && a.message.toLowerCase().includes('#1 waste producer'))));
  }, [alerts]);

  // Simulation controls state
  const [simRunning, setSimRunning] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simLoading, setSimLoading] = useState(false);
  const [simMessage, setSimMessage] = useState(null);
  const [simBoardExpanded, setSimBoardExpanded] = useState(true);

  // All-critical state
  const [allCritical, setAllCritical] = useState(false);

  // ── Heatmap + Predictive Routing state ─────────────────────────────────────
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [heatmapHoursAhead, setHeatmapHoursAhead] = useState(0);

  // ── Hotspot state ────────────────────────────────────────────────────────
  const [hotspots, setHotspots] = useState([]);
  const hotspotBinIds = useMemo(() => new Set(hotspots.map(h => h.bin_id)), [hotspots]);
  // Annotate bins with their hotspot tier so BinMap can look it up
  const annotatedBins = useMemo(() => {
    const tierMap = {};
    hotspots.forEach(h => { tierMap[h.bin_id] = h.heat_tier; });
    return bins.map(b => tierMap[b.id] ? { ...b, _hotspotTier: tierMap[b.id] } : b);
  }, [bins, hotspots]);

  const hasAutoTriggered = useRef(false);

  // Listen for emptied bins during collection tick
  useEffect(() => {
    const handleBinsEmptied = (e) => {
      const names = e.detail?.binNames || [];
      if (names.length > 0) {
        setBins(prev => prev.map(b => names.includes(b.name) ? { ...b, current_fill_percent: 5.0 } : b));
      }
    };
    window.addEventListener('amc:bins-emptied', handleBinsEmptied);
    return () => window.removeEventListener('amc:bins-emptied', handleBinsEmptied);
  }, []);

  const fetchData = useCallback(async () => {
    // During active collection, skip full bin reload to preserve real-time emptied visual states
    if (collectionActive) return;
    try {
      const [binsRes, alertsRes] = await Promise.all([
        api.get('/bins'),
        api.get('/alerts'),
      ]);
      if (binsRes.data && Array.isArray(binsRes.data) && binsRes.data.length > 0) {
        setBins(binsRes.data);
        try { localStorage.setItem('amc_bins_cache', JSON.stringify(binsRes.data)); } catch (e) {}
      }
      setAlerts(alertsRes.data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('Telemetry sync fallback (using cached/baseline grid):', err.message);
    } finally {
      setLoading(false);
    }
  }, [collectionActive]);

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
      await api.post('/simulation/toggle', { enabled: nextState, interval_seconds: 2.0 });
      setSimRunning(nextState);
      if (nextState) {
        setAllCritical(false);
        hasAutoTriggered.current = false;
        setCollectionActive(false);
        setCollectionComplete(false);
        setTruckStates([]);
        setTotalWasteCollected(0);
        await fetchData();
      }
      showSimToast(nextState ? '▶ Automated telemetry stream started (+1h step every 2s)' : '⏸ Stream paused');
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
    resetFleet();
    try {
      await api.post('/simulation/reset');
      showSimToast('↺ Entire simulation reset: All 250 AMC bins restored to baseline nominal (green <40%). Ready to re-run!');
      setAllCritical(false);
      hasAutoTriggered.current = false;
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
    
    showSimToast('🚨 All bins critical! Auto-computing 4 CVRP + A* fleet routes covering critical AMC bins...');
    
    try {
      const generatedRoutes = await fetchFleetRoutes();
      if (generatedRoutes && generatedRoutes.length > 0) {
        showSimToast(`✅ ${generatedRoutes.length} A* optimized fleet routes ready! Click "Dispatch Fleet" to begin collection.`);
      }
    } catch (err) {
      console.error('Failed to auto-generate routes:', err);
    }
  }, [fetchFleetRoutes]);

  useEffect(() => {
    if (allCritical && !hasAutoTriggered.current && !collectionActive && !collectionComplete) {
      autoGenerateRoutes();
    }
  }, [allCritical, autoGenerateRoutes, collectionActive, collectionComplete]);

  // Dispatch multi-truck collection via shared FleetContext
  const handleDispatch = async () => {
    showSimToast('🧠 Running A* pathfinding optimization on all 4 fleet routes...');
    await startCollection();
    showSimToast('✅ A* optimized routes — dispatching fleet!');
  };

  // ── WebSocket + polling ───────────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchSimStatus();
    // Fetch hotspots on load
    api.get('/analytics/hotspots').then(res => setHotspots(res.data?.hotspots || [])).catch(() => {});

    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
      .replace('http', 'ws') + '/ws';

    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'bin_update') {
            if (!collectionActive && data.bins) {
              setBins(data.bins);
            }
            if (data.alerts) {
              setAlerts(data.alerts);
            }
            if (data.sim_status) {
              setSimRunning(data.sim_status.is_running);
              setSimStep(data.sim_status.step_count);
              if (data.sim_status.all_critical) {
                setAllCritical(true);
                setSimRunning(false);
              }
            }
            setLastRefreshed(new Date());
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
    showSimToast('Computing 4 A* + CVRP fleet routes across Ahmedabad...');
    const newRoutes = await fetchFleetRoutes();
    if (newRoutes && newRoutes.length > 0) {
      showSimToast(`✅ ${newRoutes.length} A* optimized fleet routes ready! Click "Dispatch Fleet" to begin collection.`);
    }
  };

  // ── Heatmap callbacks ─────────────────────────────────────────────────────
  const handleHeatmapData = useCallback((points, hoursAhead) => {
    setHeatmapData(points);
    setHeatmapHoursAhead(hoursAhead);
  }, []);

  const handleRoutesPlanned = useCallback((plannedRoutes, hoursAhead) => {
    setRoutes(plannedRoutes);
    showSimToast(`Collection routes planned for T+${hoursAhead}h (${plannedRoutes.length} vehicles dispatched)`);
    // Smoothly scroll to map so operator sees active routes immediately
    const mapEl = document.querySelector('.dashboard-grid');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
            title="Reset entire simulation and all 250 bins to nominal"
          >
            <RotateCcw size={14} />
            <span>Reset Sim</span>
          </button>
          <button className="btn btn-secondary btn-icon-only" onClick={fetchData} title="Refresh telemetry">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── Dedicated Simulation Board / Card ── */}
      <div className="card simulation-board-card">
        <div className="card-header sim-card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-blue">
              <Activity size={12} style={{ display: 'inline', marginRight: '4px' }} />
              IoT Sensor Stream &amp; Simulation Engine
            </div>
            <h3>Smart City Real-Time Sensor Stream &amp; Stress Testing Board</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="sim-header-status-pill">
              <span className={`sim-pulse-dot ${simRunning ? 'running' : allCritical ? 'critical' : 'idle'}`}></span>
              <span className="sim-status-text">
                {collectionActive ? `Fleet Dispatched (${activeTrucks} active)` : 
                 allCritical ? '⚠ All Bins Critical (>80%) — Paused' :
                 simRunning ? 'Live Stream Active (+1h step every 2s)' : 'Simulation Standby (Manual Tick)'}
              </span>
              <span className="sim-step-badge">Step #{simStep}</span>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => setSimBoardExpanded(!simBoardExpanded)}
              style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title={simBoardExpanded ? "Collapse simulation board" : "Expand simulation board"}
            >
              {simBoardExpanded ? (
                <><ChevronUp size={14} /><span>Collapse</span></>
              ) : (
                <><ChevronDown size={14} /><span>Expand Board</span></>
              )}
            </button>
          </div>
        </div>

        {simBoardExpanded && (
          <div className="card-body sim-board-body">
            {/* Left Column: Stream Engine Controls */}
            <div className="sim-board-stream-section">
              <div className="sim-section-header">
                <span className="sim-section-title">Telemetry Playback Engine</span>
                <span className="sim-section-desc">Advance or stream automated municipal sensor fill events across Ahmedabad</span>
              </div>
              <div className="sim-stream-actions">
                <button 
                  className={`sim-btn sim-btn-lg ${simRunning ? 'sim-btn-pause' : 'sim-btn-play'}`}
                  onClick={toggleSimulation}
                  disabled={simLoading || collectionActive}
                  title={simRunning ? "Pause automated stream" : "Start automated stream"}
                >
                  {simRunning ? <Pause size={15} /> : <Play size={15} />}
                  <span>{simRunning ? 'Pause Stream' : 'Start Live Stream'}</span>
                </button>

                <button 
                  className="sim-btn sim-btn-lg sim-btn-step"
                  onClick={handleManualTick}
                  disabled={simLoading || collectionActive}
                  title="Advance telemetry by +1 hour"
                >
                  <SkipForward size={15} />
                  <span>Advance +1 Hour</span>
                </button>

                <button 
                  className="sim-btn sim-btn-lg sim-btn-reset-main"
                  onClick={handleResetSimulation}
                  disabled={simLoading}
                  title="Reset entire simulation and all 250 bins to nominal state (<40%)"
                >
                  <RotateCcw size={15} />
                  <span>Reset All Sensors</span>
                </button>
              </div>

              <div className="sim-stats-strip">
                <div className="sim-stat-chip">
                  <Clock size={13} />
                  <span>Playback: <strong>+1h / 2.0s tick</strong></span>
                </div>
                <div className="sim-stat-chip">
                  <Activity size={13} />
                  <span>Fill Evolution: <strong>+5% to 11% / tick</strong></span>
                </div>
                <div className="sim-stat-chip">
                  <Truck size={13} />
                  <span>Auto-Dispatch: <strong>Threshold ≥80%</strong></span>
                </div>
              </div>
            </div>

            {/* Right Column: Stress Testing Scenarios */}
            <div className="sim-board-anomaly-section">
              <div className="sim-section-header">
                <span className="sim-section-title">Municipal Stress Tests &amp; Anomaly Injection</span>
                <span className="sim-section-desc">Inject live sensor events to test emergency protocols &amp; A* fleet rerouting</span>
              </div>
              <div className="sim-anomaly-grid">
                <button 
                  className="sim-anomaly-card anomaly-surge"
                  onClick={() => handleInjectAnomaly('SCENARIO_RAPID_SPIKE', 'Manek Chowk Surge (94.5%)')}
                  disabled={simLoading || collectionActive}
                >
                  <div className="anomaly-icon-wrap surge"><Zap size={16} /></div>
                  <div className="anomaly-meta">
                    <span className="anomaly-name">Manek Chowk Surge</span>
                    <span className="anomaly-desc">Night market crowd spike (94.5% fill)</span>
                  </div>
                </button>

                <button 
                  className="sim-anomaly-card anomaly-tilt"
                  onClick={() => handleInjectAnomaly('SCENARIO_HIGH_TILT_VANDALISM', 'Riverfront Tilt (47.5°)')}
                  disabled={simLoading || collectionActive}
                >
                  <div className="anomaly-icon-wrap tilt"><AlertTriangle size={16} /></div>
                  <div className="anomaly-meta">
                    <span className="anomaly-name">Riverfront Tilt</span>
                    <span className="anomaly-desc">47.5° structural tilt or vandalism</span>
                  </div>
                </button>

                <button 
                  className="sim-anomaly-card anomaly-fire"
                  onClick={() => handleInjectAnomaly('SCENARIO_THERMAL_ANOMALY', 'Law Garden Heat (64.2°C)')}
                  disabled={simLoading || collectionActive}
                >
                  <div className="anomaly-icon-wrap fire"><Flame size={16} /></div>
                  <div className="anomaly-meta">
                    <span className="anomaly-name">Thermal Hazard</span>
                    <span className="anomaly-desc">64.2°C heat anomaly at Law Garden</span>
                  </div>
                </button>

                <button 
                  className="sim-anomaly-card anomaly-citywide"
                  onClick={handleManualTick}
                  disabled={simLoading || collectionActive}
                >
                  <div className="anomaly-icon-wrap citywide"><TrendingUp size={16} /></div>
                  <div className="anomaly-meta">
                    <span className="anomaly-name">Step Citywide Telemetry</span>
                    <span className="anomaly-desc">Evolve all 250 sensors toward critical</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {simBoardExpanded && simMessage && (
          <div className="sim-board-toast">
            <Sparkles size={14} />
            <span>{simMessage}</span>
          </div>
        )}
      </div>

      {/* ── Special Alert: Municipal #1 Waste Hotspot ── */}
      {specialTopAlert && (
        <div className="analytics-special-alert-banner" style={{ marginBottom: '24px' }}>
          <div className="asab-left">
            <div className="asab-icon-pod">
              <Crown size={24} className="asab-crown-icon" />
            </div>
            <div className="asab-text">
              <div className="asab-header-row">
                <span className="asab-badge">
                  <span className="asab-live-beacon" />
                  <span>MUNICIPAL #1 PRODUCER</span>
                </span>
                <span className="asab-zone-pill">
                  <MapPin size={11} />
                  <span>{specialTopAlert.zone || 'Central Zone (Khadia/Riverfront)'}</span>
                </span>
                <span className="asab-telemetry-tag">
                  <Flame size={11} />
                  <span>High Volume Surge</span>
                </span>
              </div>
              <h3 className="asab-title">Municipal #1 Waste Producer Critical Priority</h3>
              <p className="asab-desc">
                {specialTopAlert.message ? specialTopAlert.message.replace(/^🚨\s*\[SPECIAL ALERT[^\n\]]*\]\s*/i, '') : specialTopAlert.message}
              </p>
            </div>
          </div>
          <button 
            className="asab-action-btn"
            onClick={() => navigate('/fleet')}
          >
            <Truck size={16} />
            <span>Track Fleet</span>
            <ChevronRight size={14} className="asab-btn-chevron" />
          </button>
        </div>
      )}

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
                onClick={handleDispatch}
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
                <p>A* optimized routes — {activeTrucks} truck{activeTrucks !== 1 ? 's' : ''} active, {totalStopsDone}/{totalPlannedStops || bins.length || 250} stops completed</p>
              </div>
            </div>
            <div className="collection-banner-stats">
              <div className="collection-stat-item">
                <span className="collection-stat-value">{totalWasteCollected}L</span>
                <span className="collection-stat-label">Total Collected</span>
              </div>
              <div className="collection-stat-divider"></div>
              <div className="collection-stat-item">
                <span className="collection-stat-value">{totalStopsDone}/{totalPlannedStops || bins.length || 250}</span>
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

      {/* Stats Metric Cards */}
      <div className="hud-kpi-matrix-5" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Monitored Fleet Size */}
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Fleet Monitored</span>
              <div className="kpi-icon-pill icon-dark">
                <Trash2 size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">{totalBins}</span>
              <span className="kpi-unit">Bins</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #60a5fa, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">Active telemetry across <strong>5 AMC Zones</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 2: Critical Overflow */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-coral"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag" style={{ color: '#e11d48' }}>Urgent Attention</span>
              <div className="kpi-icon-pill icon-coral">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-coral-gradient">{criticalBins}</span>
              <span className="kpi-unit-pill pill-coral">{criticalBinsPercent}% of Fleet</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-coral" style={{ width: `${Math.min(criticalBinsPercent * 2.5, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">Bins exceeding <strong>80% threshold</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Fill Capacity */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-amber"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Fleet Capacity</span>
              <div className="kpi-icon-pill icon-amber">
                <Gauge size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-amber-gradient">{avgFill}%</span>
              <span className="kpi-unit-pill pill-amber">Average</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ 
                  width: `${avgFill}%`, 
                  background: avgFill > 70 ? '#f43f5e' : avgFill > 45 ? '#f59e0b' : '#10b981' 
                }}></div>
              </div>
              <span className="kpi-subtext"><strong>{filledBinsPercent}%</strong> of bins &ge; 50% capacity</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Sensor Anomalies / Alerts */}
        <div className="hud-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/notifications')} title="View all incident notifications">
          <div className="kpi-card-glow-bg glow-violet"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Sensor Anomalies</span>
              <div className="kpi-icon-pill icon-violet">
                <Bell size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-violet-gradient">{activeAlerts}</span>
              <span className="kpi-unit-pill pill-violet">Active</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-violet" style={{ width: `${Math.min(activeAlerts * 20, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext" style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#7c3aed', fontWeight: 600 }}>
                Notification Center <ChevronRight size={12} />
              </span>
            </div>
          </div>
        </div>

        {/* KPI 5: Fleet Control */}
        <div className="hud-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/fleet')} title="Open Dedicated Fleet Tracker">
          <div className="kpi-card-glow-bg glow-cyan"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Fleet Control</span>
              <div className="kpi-icon-pill icon-cyan">
                <Truck size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-cyan-gradient">{Math.min(routes.length, 4) || 4}</span>
              <span className="kpi-unit-pill pill-cyan">{collectionActive ? `${activeTrucks} Active` : collectionComplete ? 'Complete' : 'Ready'}</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-cyan" style={{ width: `${collectionActive ? Math.min((totalStopsDone / (totalPlannedStops || bins.length || 250)) * 100, 100) : collectionComplete ? 100 : 25}%` }}></div>
              </div>
              <span className="kpi-subtext" style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#0891b2', fontWeight: 600 }}>
                {collectionActive ? `${totalStopsDone}/${totalPlannedStops || bins.length || 250} stops` : 'Fleet Tracker'} <ChevronRight size={12} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Per-Truck Live Cards (above map, shown when collection active) ── */}
      {(collectionActive || collectionComplete) && truckStates.length > 0 && (
        <div className="card truck-cards-above-map">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-blue">
                <Truck size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {collectionComplete ? 'Route Complete' : 'Live Fleet Tracking'}
              </div>
              <h3>{collectionComplete ? 'All Routes Serviced' : `Fleet In Progress — ${activeTrucks} Truck${activeTrucks !== 1 ? 's' : ''} Active`}</h3>
            </div>
            <span className="pill-counter">{totalStopsDone}/{totalPlannedStops || bins.length || 250} Stops · {totalWasteCollected}L Collected</span>
          </div>
          <div className="card-body">
            <div className="truck-cards-grid">
              {truckStates.map((truck, idx) => (
                <div
                  key={idx}
                  className={`truck-card-above-map ${truck.done ? 'truck-card-done' : 'truck-card-active'}`}
                  onClick={() => setSelectedTruck(truck)}
                  title="Click for full truck dossier"
                >
                  <div className="tca-header">
                    <span className="tca-color-bar" style={{ background: truck.color }} />
                    <div className="tca-name-col">
                      <span className="tca-name">{truck.vehicleName}</span>
                      <span className="tca-driver">{truck.driver?.name}</span>
                    </div>
                    {truck.done ? (
                      <span className="tca-status-pill done"><CheckCircle2 size={11} /> Done</span>
                    ) : (
                      <span className="tca-status-pill active">En Route</span>
                    )}
                  </div>
                  <div className="tca-stats">
                    <div className="tca-stat">
                      <span className="tca-stat-val" style={{ color: truck.color }}>{truck.wasteCollected}L</span>
                      <span className="tca-stat-lbl">Collected</span>
                    </div>
                    <div className="tca-divider" />
                    <div className="tca-stat">
                      <span className="tca-stat-val">{truck.stopsCompleted.length}<span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>/{truck.totalStops}</span></span>
                      <span className="tca-stat-lbl">Stops</span>
                    </div>
                    <div className="tca-divider" />
                    <div className="tca-stat">
                      <span className="tca-stat-val">{Math.round((truck.stopsCompleted.length / Math.max(truck.totalStops, 1)) * 100)}%</span>
                      <span className="tca-stat-lbl">Progress</span>
                    </div>
                  </div>
                  {!truck.done && truck.currentStopIdx >= 0 && truck.stops[truck.currentStopIdx] && (
                    <div className="tca-current-stop">
                      <MapPin size={10} />
                      <span>{truck.stops[truck.currentStopIdx].bin_name}</span>
                    </div>
                  )}
                  <div className="tca-progress-bar">
                    <div
                      className="tca-progress-fill"
                      style={{
                        width: `${Math.round((truck.stopsCompleted.length / Math.max(truck.totalStops, 1)) * 100)}%`,
                        background: truck.done ? '#10b981' : truck.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Expansive Large Municipal Map Section ── */}
      <div className="full-width-map-section">
        <div className="card map-card large-map-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge">AMC Municipal Geospatial Grid</div>
              <h3>Ahmedabad Smart Bin Network — {bins.length || 250} Real-Time Municipal Bins</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/fleet')}>
                <Truck size={15} />
                <span>Open Fleet Tracker</span>
              </button>
              {!collectionActive && routes.length > 0 && (
                <button 
                  className="btn btn-primary" 
                  onClick={handleDispatch}
                  disabled={routeLoading}
                  title="Dispatch collection fleet"
                >
                  <Truck size={15} />
                  <span>Dispatch Fleet ({Math.min(routes.length, 4)} Trucks)</span>
                </button>
              )}
              {collectionActive && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    resetFleet();
                    showSimToast('Fleet simulation reset to depot standby.');
                  }}
                  title="Reset collection fleet"
                >
                  <RotateCcw size={15} />
                  <span>Reset Fleet</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={generateRoutes} disabled={routeLoading || collectionActive}>
                {routeLoading ? (
                  <><RefreshCw size={15} className="spin" /><span>Computing CVRP...</span></>
                ) : (
                  <><RefreshCw size={15} /><span>Recompute Routes</span></>
                )}
              </button>
            </div>
          </div>
          <div className="card-body no-padding">
            <BinMap
              bins={annotatedBins}
              routes={routes}
              truckStates={truckStates}
              collectionActive={collectionActive}
              totalWasteCollected={totalWasteCollected}
              heatmapData={heatmapData}
              heatmapMode={heatmapMode}
              heatmapHoursAhead={heatmapHoursAhead}
              onSelectTruck={setSelectedTruck}
              hotspotBinIds={hotspotBinIds}
            />
          </div>
        </div>
      </div>

      {/* ── AI Forecast Spotlight Card (linking to dedicated /forecast page) ── */}
      <div className="forecast-teaser-card">
        <div className="forecast-teaser-left">
          <div className="forecast-teaser-icon">
            <TrendingUp size={24} />
          </div>
          <div className="forecast-teaser-info">
            <h4>AI Fill Level Forecast &amp; Predictive Route Dispatch</h4>
            <p>
              Neural &amp; linear time-horizon drift projections (1h to 72h) across all {bins.length || 250} AMC smart bins. Anticipate overflows and generate proactive CVRP collection routes before emergency thresholds are breached.
            </p>
          </div>
        </div>
        <button 
          className="forecast-teaser-action" 
          onClick={() => navigate('/forecast')}
          title="Open Dedicated AI Forecast Page"
        >
          <span>Open AI Forecast Studio</span>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Fleet Analytics Full Width Section ── */}
      <div className="dashboard-charts-full">
        <div className="card charts-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-blue">Fleet Analytics</div>
              <h3>Waste Composition &amp; Fill Level Distribution</h3>
            </div>
            <span className="pill-counter">{bins.length || 250} Bins Monitored Across 5 AMC Zones</span>
          </div>
          <div className="card-body">
            <StatsCharts bins={bins} />
          </div>
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

export default Dashboard;
