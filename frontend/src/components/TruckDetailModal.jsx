import { useState, useEffect } from 'react';
import {
  Truck,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Gauge,
  Navigation,
  Activity,
  Sparkles,
  Clock,
  Fuel,
  Package,
  X,
  Award,
  Layers,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function TruckDetailModal({ truck, onClose }) {
  const [activeTab, setActiveTab] = useState('telemetry');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!truck) return null;

  const progressPct = Math.min(
    100,
    Math.round(((truck.wasteCollected || 0) / (truck.capacityLiters || 5000)) * 100)
  );

  const isCollecting = !truck.done && truck.currentStopIdx >= 0;
  const currentStop = truck.stops && truck.currentStopIdx >= 0 ? truck.stops[truck.currentStopIdx] : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="truck-modal-container" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Modal Header ── */}
        <div className="truck-modal-header">
          <div className="tm-header-left">
            <div className="tm-color-indicator" style={{ background: truck.color }} />
            <div>
              <div className="tm-title-row">
                <h2 className="tm-vehicle-name">{truck.vehicleName}</h2>
                <div className="tdc-plate-badge tm-plate-badge" title="AMC Municipal Vehicle Registration">
                  <span className="plate-ind">IND</span>
                  <span>{truck.plateNumber}</span>
                </div>
              </div>
              <div className="tm-subtitle-row">
                <span className="tm-model-tag"><Truck size={13} /> {truck.model}</span>
                <span className="tm-zone-tag"><MapPin size={13} /> {truck.zone}</span>
              </div>
            </div>
          </div>

          <div className="tm-header-right">
            <div className={`tdc-status-pill ${truck.done ? 'done' : isCollecting ? 'active' : 'ready'}`}>
              {isCollecting && <span className="live-ping-dot" />}
              <span>{truck.done ? 'Service Complete' : isCollecting ? 'En Route Live' : 'Depot Standby'}</span>
            </div>
            <button className="tm-close-btn" onClick={onClose} aria-label="Close popup">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Quick Stats Strip ── */}
        <div className="tm-quick-strip">
          <div className="tm-quick-item">
            <span className="tm-quick-label">Operating Depot</span>
            <span className="tm-quick-val">{truck.depotName || 'Central Municipal Hub'}</span>
          </div>
          <div className="tm-quick-item">
            <span className="tm-quick-label">Fuel / Powertrain</span>
            <span className="tm-quick-val highlight-fuel">{truck.fuelType || 'CNG Green Fleet'}</span>
          </div>
          <div className="tm-quick-item">
            <span className="tm-quick-label">Compactor Tank</span>
            <span className="tm-quick-val">{truck.capacityLiters || 5000} Liters</span>
          </div>
          <div className="tm-quick-item">
            <span className="tm-quick-label">Assigned Driver</span>
            <span className="tm-quick-val">{truck.driver?.name || 'Assigned Staff'}</span>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="tm-tabs">
          <button 
            className={`tm-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            <Activity size={14} />
            <span>Live Telemetry &amp; Payload</span>
          </button>
          <button 
            className={`tm-tab-btn ${activeTab === 'driver' ? 'active' : ''}`}
            onClick={() => setActiveTab('driver')}
          >
            <User size={14} />
            <span>Driver Credentials</span>
          </button>
          <button 
            className={`tm-tab-btn ${activeTab === 'stops' ? 'active' : ''}`}
            onClick={() => setActiveTab('stops')}
          >
            <Layers size={14} />
            <span>Route Sequence ({truck.stops?.length || 0} stops)</span>
          </button>
          <button 
            className={`tm-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
            onClick={() => setActiveTab('specs')}
          >
            <ShieldCheck size={14} />
            <span>Vehicle Specifications</span>
          </button>
        </div>

        {/* ── Modal Body Content ── */}
        <div className="truck-modal-body">
          {/* TAB 1: LIVE TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div className="tm-tab-content tm-telemetry-content">
              {/* Payload Meter Card */}
              <div className="tm-card tm-payload-card">
                <div className="tm-card-title-row">
                  <div className="tm-card-title">
                    <Package size={16} />
                    <span>Hydraulic Compaction Payload Tank</span>
                  </div>
                  <span className="tm-payload-pct" style={{ color: truck.color }}>
                    {progressPct}% Loaded
                  </span>
                </div>

                <div className="tm-payload-gauge-track">
                  <div 
                    className="tm-payload-gauge-fill" 
                    style={{ 
                      width: `${progressPct}%`,
                      background: `linear-gradient(90deg, ${truck.color}, #10b981)`
                    }} 
                  />
                </div>

                <div className="tm-payload-metric-grid">
                  <div className="tm-pm-item">
                    <span className="tm-pm-label">Compacted Solid Waste</span>
                    <span className="tm-pm-val">{truck.wasteCollected || 0} Liters</span>
                  </div>
                  <div className="tm-pm-item">
                    <span className="tm-pm-label">Remaining Tank Capacity</span>
                    <span className="tm-pm-val">
                      {Math.max(0, (truck.capacityLiters || 5000) - (truck.wasteCollected || 0))} Liters
                    </span>
                  </div>
                  <div className="tm-pm-item">
                    <span className="tm-pm-label">Compactor Total Capacity</span>
                    <span className="tm-pm-val">{truck.capacityLiters || 5000} L</span>
                  </div>
                </div>
              </div>

              {/* Real-time Telemetry Grid */}
              <div className="tm-telem-grid">
                <div className="tm-telem-card">
                  <div className="tm-tc-header">
                    <Gauge size={16} />
                    <span>Telemetry Speed</span>
                  </div>
                  <div className="tm-tc-val">{truck.speed || (isCollecting ? '26 km/h' : '0 km/h (Depot Standby)')}</div>
                  <div className="tm-tc-sub">GPS Real-time OBD-II Stream</div>
                </div>

                <div className="tm-telem-card">
                  <div className="tm-tc-header">
                    <Navigation size={16} />
                    <span>Target Destination</span>
                  </div>
                  <div className="tm-tc-val tm-tc-val-dest" title={currentStop?.bin_name || 'Depot Hub'}>
                    {currentStop ? currentStop.bin_name : (truck.done ? 'Pirana Disposal Plant' : 'Depot Hub')}
                  </div>
                  <div className="tm-tc-sub">Next scheduled collection waypoint</div>
                </div>

                <div className="tm-telem-card">
                  <div className="tm-tc-header">
                    <CheckCircle2 size={16} />
                    <span>Service Fulfillment</span>
                  </div>
                  <div className="tm-tc-val">
                    {truck.stopsCompleted?.length || 0} / {truck.totalStops || truck.stops?.length || 10}
                  </div>
                  <div className="tm-tc-sub">Bins emptied &amp; compacted</div>
                </div>

                <div className="tm-telem-card">
                  <div className="tm-tc-header">
                    <MapPin size={16} />
                    <span>GPS Coordinates</span>
                  </div>
                  <div className="tm-tc-val" style={{ fontSize: '0.9rem' }}>
                    {truck.position ? `${truck.position.lat.toFixed(4)}°N, ${truck.position.lng.toFixed(4)}°E` : '23.0345°N, 72.5564°E'}
                  </div>
                  <div className="tm-tc-sub">Active Ahmedabad Municipal Grid</div>
                </div>
              </div>

              {/* A* Optimization Stats */}
              {truck.astarMetrics && (
                <div className="tm-astar-banner">
                  <div className="tm-astar-left">
                    <Sparkles size={18} className="tm-astar-icon" />
                    <div>
                      <div className="tm-astar-title">A* Pathfinding &amp; CVRP Route Optimization Active</div>
                      <div className="tm-astar-desc">
                        Road-network trajectory calculated via OSRM graph search, avoiding pedestrian corridors &amp; respecting Sabarmati River bridges.
                      </div>
                    </div>
                  </div>
                  <div className="tm-astar-stats">
                    <div className="tm-as-chip">
                      <strong>{truck.astarMetrics.totalDistance || 13.5} km</strong> Total Distance
                    </div>
                    <div className="tm-as-chip">
                      <strong>{truck.astarMetrics.nodesExplored || 10}</strong> Waypoints
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DRIVER CREDENTIALS */}
          {activeTab === 'driver' && (
            <div className="tm-tab-content tm-driver-content">
              <div className="tm-driver-profile-card">
                <div className="tm-driver-hero">
                  <div className="tm-driver-avatar-lg">
                    <User size={36} />
                  </div>
                  <div className="tm-driver-hero-info">
                    <div className="tm-driver-name-lg">{truck.driver?.name || 'Rajesh Patel'}</div>
                    <div className="tm-driver-badge-row">
                      <span className="tm-badge-empid">EMP ID: {truck.driver?.empId || 'AMC-DRV-104'}</span>
                      <span className="tm-badge-rating"><Award size={12} /> {truck.driver?.rating || '4.9 ★'} Operator</span>
                      <span className="tm-badge-status">Active Duty</span>
                    </div>
                  </div>
                </div>

                <div className="tm-driver-details-grid">
                  <div className="tm-dd-item">
                    <span className="tm-dd-label">Mobile Contact</span>
                    <span className="tm-dd-val">{truck.driver?.phone || '+91 98251 44821'}</span>
                  </div>
                  <div className="tm-dd-item">
                    <span className="tm-dd-label">Total Commercial Experience</span>
                    <span className="tm-dd-val">{truck.driver?.experience || '8 Years'}</span>
                  </div>
                  <div className="tm-dd-item">
                    <span className="tm-dd-label">Assigned Duty Shift</span>
                    <span className="tm-dd-val">{truck.driver?.shift || 'Morning Shift (06:00 - 14:00)'}</span>
                  </div>
                  <div className="tm-dd-item">
                    <span className="tm-dd-label">License Category</span>
                    <span className="tm-dd-val">{truck.driver?.licenseType || 'Commercial Heavy (HMV)'}</span>
                  </div>
                  <div className="tm-dd-item">
                    <span className="tm-dd-label">Assigned Municipal Sector</span>
                    <span className="tm-dd-val">{truck.zone || 'West Zone'}</span>
                  </div>
                  <div className="tm-dd-item">
                    <span className="tm-dd-label">Medical &amp; Police Verification</span>
                    <span className="tm-dd-val tm-verified"><ShieldCheck size={14} /> AMC Certified &amp; Cleared</span>
                  </div>
                </div>

                <div className="tm-driver-actions">
                  <a 
                    href={`tel:${truck.driver?.phone}`} 
                    className="btn btn-primary tm-btn-call"
                  >
                    <Phone size={15} />
                    <span>Call Driver Direct ({truck.driver?.phone})</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROUTE STOPS SEQUENCE */}
          {activeTab === 'stops' && (
            <div className="tm-tab-content tm-stops-content">
              <div className="tm-stops-header">
                <div>
                  <h4>Full Stop Sequence — A* Optimized Waypoints</h4>
                  <p>Chronological sequence of collection bins assigned to this vehicle for today's CVRP run.</p>
                </div>
                <span className="pill-counter">
                  {truck.stopsCompleted?.length || 0} / {truck.stops?.length || 10} Done
                </span>
              </div>

              <div className="tm-stops-list">
                {truck.stops && truck.stops.length > 0 ? (
                  truck.stops.map((stop, sIdx) => {
                    const isCompleted = truck.stopsCompleted?.some(sc => sc.binName === stop.bin_name || sc.stopIdx === sIdx);
                    const isTarget = !isCompleted && truck.currentStopIdx === sIdx;

                    return (
                      <div 
                        key={sIdx} 
                        className={`tm-stop-card ${isCompleted ? 'completed' : isTarget ? 'current-target' : 'pending'}`}
                      >
                        <div className="tm-stop-num">
                          {isCompleted ? <CheckCircle2 size={16} /> : sIdx + 1}
                        </div>
                        <div className="tm-stop-main">
                          <div className="tm-stop-name">{stop.bin_name}</div>
                          <div className="tm-stop-meta">
                            <span>Fill: <strong>{Math.round(stop.fill_percent)}%</strong></span>
                            <span>·</span>
                            <span>Waste: <strong>{Math.round(stop.fill_percent * 2.4)}L</strong></span>
                            {stop.lat && (
                              <>
                                <span>·</span>
                                <span className="tm-stop-coords">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="tm-stop-status">
                          {isCompleted ? (
                            <span className="tm-badge-done">Serviced</span>
                          ) : isTarget ? (
                            <span className="tm-badge-target">En Route</span>
                          ) : (
                            <span className="tm-badge-pending">Queued</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="tm-empty-stops">
                    <AlertCircle size={24} />
                    <p>No active stops assigned. Vehicle is standing by at depot or route has not been generated.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: VEHICLE SPECIFICATIONS */}
          {activeTab === 'specs' && (
            <div className="tm-tab-content tm-specs-content">
              <div className="tm-specs-grid">
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Commercial Vehicle Model</span>
                  <span className="tm-sb-val">{truck.model}</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Registration Number (RTO)</span>
                  <span className="tm-sb-val font-mono">{truck.plateNumber} (GJ-01 Ahmedabad)</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Compaction Mechanism</span>
                  <span className="tm-sb-val">Hydraulic Ram Compactor (Ratio 3:1)</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Payload Capacity</span>
                  <span className="tm-sb-val">{truck.capacityLiters || 5000} Liters Compactor Tank</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Powertrain &amp; Emissions</span>
                  <span className="tm-sb-val">{truck.fuelType} · Zero/Low Emission Compliance</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Telematics Hardware</span>
                  <span className="tm-sb-val">GPS/GLONASS Dual-Band Tracker + OBD-II Telemetry</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Assigned Municipal Depot</span>
                  <span className="tm-sb-val">{truck.depotName}</span>
                </div>
                <div className="tm-spec-box">
                  <span className="tm-sb-label">Solid Waste Disposal Hub</span>
                  <span className="tm-sb-val">Pirana Municipal Solid Waste Management Complex</span>
                </div>
              </div>

              <div className="tm-specs-cert-card">
                <ShieldCheck size={24} className="tm-cert-icon" />
                <div>
                  <div className="tm-cert-title">Ahmedabad Municipal Corporation (AMC) Registered Asset</div>
                  <div className="tm-cert-sub">
                    Solid Waste Management Department · Smart City Mission Telemetry Integration · Real-Time Compliance Monitored.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="truck-modal-footer">
          <div className="tm-footer-left">
            <span className="live-dot" />
            <span className="tm-footer-live-text">Live telemetry synchronized with central AMC municipal servers</span>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
