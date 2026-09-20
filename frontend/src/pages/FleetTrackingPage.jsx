import { useState, useEffect, useCallback } from 'react';
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
import { useFleet } from '../context/FleetContext';
import { DEFAULT_BINS } from '../data/defaultBins';

export default function FleetTrackingPage() {
  const {
    routes,
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
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchBins = useCallback(async () => {
    try {
      const binsRes = await api.get('/bins');
      if (binsRes.data && Array.isArray(binsRes.data) && binsRes.data.length > 0) {
        setBins(binsRes.data);
        try { localStorage.setItem('amc_bins_cache', JSON.stringify(binsRes.data)); } catch (e) {}
      }
    } catch (err) {
      console.warn('Fleet map using cached/baseline bins:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  // Listen for emptied bins during collection tick
  useEffect(() => {
    const handleBinsEmptied = (e) => {
      const names = e.detail?.binNames || [];
      if (names.length > 0) {
        setBins(prev => prev.map(bin => {
          if (names.includes(bin.name)) {
            return { ...bin, current_fill_percent: 5.0 };
          }
          return bin;
        }));
      }
    };
    window.addEventListener('amc:bins-emptied', handleBinsEmptied);
    return () => window.removeEventListener('amc:bins-emptied', handleBinsEmptied);
  }, []);

  // Dispatch multi-truck collection
  const handleDispatch = async () => {
    showToast('🧠 Running A* pathfinding optimization on all 4 fleet routes...');
    await startCollection();
    showToast('✅ A* optimized 4 routes — dispatching fleet!');
  };

  const handleReset = () => {
    resetFleet();
    fetchBins();
    showToast('Fleet simulation reset to depot standby.');
  };

  const handleRecompute = async () => {
    showToast('Computing 4 A* + CVRP fleet routes across Ahmedabad...');
    const newRoutes = await fetchFleetRoutes();
    showToast(`✅ ${newRoutes?.length || 0} vehicle routes computed and road-snapped.`);
  };

  const completionPct = totalPlannedStops > 0 ? Math.round((totalStopsDone / totalPlannedStops) * 100) : 0;

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
              onClick={handleDispatch}
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
            onClick={handleRecompute}
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

      {/* ── Fleet HUD KPI Matrix ────────────────────────────────────────────── */}
      <div className="hud-kpi-matrix" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Active Fleet */}
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Active Fleet</span>
              <div className="kpi-icon-pill icon-dark">
                <Truck size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">{collectionActive ? activeTrucks : '4 Ready'}</span>
              <span className="kpi-unit">Carriers</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #60a5fa, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">
                {collectionActive ? '● En route across AMC city zones' : 'Standby at Ahmedabad depots'}
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total Waste Loaded */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-coral"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag" style={{ color: '#e11d48' }}>Compacted Load</span>
              <div className="kpi-icon-pill icon-coral">
                <Package size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-coral-gradient">{totalWasteCollected.toLocaleString()}</span>
              <span className="kpi-unit-pill pill-coral">Liters</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-coral" style={{ width: `${Math.min((totalWasteCollected / 10000) * 100, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">
                Disposed at <strong>Pirana Municipal Facility</strong>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Service Progress */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-emerald"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Service Progress</span>
              <div className="kpi-icon-pill icon-emerald">
                <Gauge size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-emerald-gradient">{totalStopsDone}/{totalPlannedStops || 40}</span>
              <span className="kpi-unit-pill pill-emerald">{completionPct}% Done</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-emerald" style={{ width: `${completionPct}%` }}></div>
              </div>
              <span className="kpi-subtext">
                Automated <strong>stop verification &amp; telematics</strong>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Navigation Engine */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-violet"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Routing Core</span>
              <div className="kpi-icon-pill icon-violet">
                <Navigation size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-violet-gradient">A* + CVRP</span>
              <span className="kpi-unit-pill pill-violet">OSRM Snapped</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-violet" style={{ width: '100%' }}></div>
              </div>
              <span className="kpi-subtext">
                River bridges &amp; <strong>Sabarmati corridors</strong> respected
              </span>
            </div>
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
