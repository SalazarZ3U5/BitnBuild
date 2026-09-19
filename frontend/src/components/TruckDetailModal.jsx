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
  Fuel,
  Package,
  X,
  Award,
  Layers,
  AlertCircle
} from 'lucide-react';

export default function TruckDetailModal({ truck, onClose }) {
  const [activeTab, setActiveTab] = useState('telemetry');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
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
  const stopProgress = Math.round(((truck.stopsCompleted?.length || 0) / Math.max(truck.stops?.length || 1, 1)) * 100);

  const tabs = [
    { id: 'telemetry', label: 'Live Telemetry', icon: Activity },
    { id: 'driver',    label: 'Driver',          icon: User },
    { id: 'stops',     label: `Stops (${truck.stops?.length || 0})`, icon: Layers },
    { id: 'specs',     label: 'Specs',            icon: ShieldCheck },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="tdm-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="tdm-header">
          <div className="tdm-header-left">
            <div className="tdm-color-bar" style={{ background: truck.color }} />
            <div className="tdm-title-block">
              <div className="tdm-title-row">
                <h2 className="tdm-vehicle-name">{truck.vehicleName}</h2>
                <div className="tdm-plate">
                  <span className="tdm-plate-ind">IND</span>
                  <span>{truck.plateNumber}</span>
                </div>
              </div>
              <div className="tdm-subtitle-row">
                <span className="tdm-meta-tag"><Truck size={12} /> {truck.model}</span>
                <span className="tdm-meta-tag"><MapPin size={12} /> {truck.zone}</span>
                <span className="tdm-meta-tag"><Fuel size={12} /> {truck.fuelType}</span>
              </div>
            </div>
          </div>

          <div className="tdm-header-right">
            <div className={`tdm-status-badge ${truck.done ? 'done' : isCollecting ? 'active' : 'ready'}`}>
              {isCollecting && <span className="live-ping-dot" />}
              {truck.done ? 'Route Complete' : isCollecting ? 'En Route Live' : 'Depot Standby'}
            </div>
            <button className="tdm-close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Quick Stats Bar ──────────────────────────────────────────────── */}
        <div className="tdm-quick-bar">
          <div className="tdm-quick-item">
            <span className="tdm-q-label">Waste Collected</span>
            <span className="tdm-q-val" style={{ color: truck.color }}>{truck.wasteCollected || 0}L</span>
          </div>
          <div className="tdm-q-divider" />
          <div className="tdm-quick-item">
            <span className="tdm-q-label">Stops Done</span>
            <span className="tdm-q-val">{truck.stopsCompleted?.length || 0} / {truck.stops?.length || 0}</span>
          </div>
          <div className="tdm-q-divider" />
          <div className="tdm-quick-item">
            <span className="tdm-q-label">Route Progress</span>
            <span className="tdm-q-val">{stopProgress}%</span>
          </div>
          <div className="tdm-q-divider" />
          <div className="tdm-quick-item">
            <span className="tdm-q-label">Tank Capacity</span>
            <span className="tdm-q-val">{truck.capacityLiters || 5000}L</span>
          </div>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="tdm-tab-bar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tdm-tab ${activeTab === tab.id ? 'tdm-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────── */}
        <div className="tdm-body">

          {/* TAB: LIVE TELEMETRY */}
          {activeTab === 'telemetry' && (
            <div className="tdm-tab-content">
              {/* Payload Tank */}
              <div className="tdm-section">
                <div className="tdm-section-header">
                  <Package size={15} />
                  <span>Hydraulic Compaction Tank</span>
                  <span className="tdm-section-badge" style={{ color: truck.color }}>{progressPct}% Loaded</span>
                </div>
                <div className="tdm-gauge-track">
                  <div 
                    className="tdm-gauge-fill"
                    style={{ 
                      width: `${progressPct}%`,
                      background: `linear-gradient(90deg, ${truck.color}, #10b981)` 
                    }}
                  />
                </div>
                <div className="tdm-payload-row">
                  <div className="tdm-payload-item">
                    <span className="tdm-pl-label">Compacted Waste</span>
                    <span className="tdm-pl-val">{truck.wasteCollected || 0} L</span>
                  </div>
                  <div className="tdm-payload-item">
                    <span className="tdm-pl-label">Remaining Capacity</span>
                    <span className="tdm-pl-val">{Math.max(0, (truck.capacityLiters || 5000) - (truck.wasteCollected || 0))} L</span>
                  </div>
                  <div className="tdm-payload-item">
                    <span className="tdm-pl-label">Total Tank Size</span>
                    <span className="tdm-pl-val">{truck.capacityLiters || 5000} L</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Grid */}
              <div className="tdm-telem-grid">
                <div className="tdm-telem-card">
                  <div className="tdm-tc-icon"><Gauge size={18} /></div>
                  <div className="tdm-tc-label">Live Speed</div>
                  <div className="tdm-tc-value">{truck.speed || (isCollecting ? '26 km/h' : '0 km/h')}</div>
                  <div className="tdm-tc-sub">GPS OBD-II Stream</div>
                </div>

                <div className="tdm-telem-card">
                  <div className="tdm-tc-icon"><Navigation size={18} /></div>
                  <div className="tdm-tc-label">Target Waypoint</div>
                  <div className="tdm-tc-value tdm-tc-ellipsis" title={currentStop?.bin_name || 'Depot Hub'}>
                    {currentStop ? currentStop.bin_name : (truck.done ? 'Pirana Disposal Plant' : 'Depot Hub')}
                  </div>
                  <div className="tdm-tc-sub">Next scheduled stop</div>
                </div>

                <div className="tdm-telem-card">
                  <div className="tdm-tc-icon"><CheckCircle2 size={18} /></div>
                  <div className="tdm-tc-label">Service Fulfillment</div>
                  <div className="tdm-tc-value">{truck.stopsCompleted?.length || 0} / {truck.totalStops || truck.stops?.length || 10}</div>
                  <div className="tdm-tc-sub">Bins emptied</div>
                </div>

                <div className="tdm-telem-card">
                  <div className="tdm-tc-icon"><MapPin size={18} /></div>
                  <div className="tdm-tc-label">GPS Coordinates</div>
                  <div className="tdm-tc-value" style={{ fontSize: '0.82rem' }}>
                    {truck.position ? `${truck.position.lat.toFixed(4)}°N, ${truck.position.lng.toFixed(4)}°E` : '23.0345°N, 72.5564°E'}
                  </div>
                  <div className="tdm-tc-sub">Ahmedabad Municipal Grid</div>
                </div>
              </div>

              {/* A* Banner */}
              {truck.astarMetrics && (
                <div className="tdm-astar-banner">
                  <Sparkles size={16} className="tdm-astar-icon" />
                  <div className="tdm-astar-content">
                    <div className="tdm-astar-title">A* Pathfinding + CVRP Route Optimization</div>
                    <div className="tdm-astar-sub">Road-network trajectory via OSRM · Sabarmati River bridges respected</div>
                  </div>
                  <div className="tdm-astar-chips">
                    <div className="tdm-astar-chip"><strong>{truck.astarMetrics.totalDistance || 13.5} km</strong> Distance</div>
                    <div className="tdm-astar-chip"><strong>{truck.astarMetrics.nodesExplored || 10}</strong> Waypoints</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: DRIVER */}
          {activeTab === 'driver' && (
            <div className="tdm-tab-content">
              <div className="tdm-driver-hero-card">
                <div className="tdm-driver-avatar">
                  <User size={32} />
                </div>
                <div className="tdm-driver-hero-info">
                  <div className="tdm-driver-name">{truck.driver?.name || 'Rajesh Patel'}</div>
                  <div className="tdm-driver-badges">
                    <span className="tdm-badge emp">EMP: {truck.driver?.empId || 'AMC-DRV-104'}</span>
                    <span className="tdm-badge rating"><Award size={11} /> {truck.driver?.rating || '4.9 ★'}</span>
                    <span className="tdm-badge active-badge">● Active Duty</span>
                  </div>
                </div>
                <a 
                  href={`tel:${truck.driver?.phone}`} 
                  className="btn btn-primary tdm-call-btn"
                >
                  <Phone size={15} />
                  <span>Call Driver</span>
                </a>
              </div>

              <div className="tdm-driver-details">
                <div className="tdm-dd-row">
                  <span className="tdm-dd-label">Mobile Contact</span>
                  <span className="tdm-dd-val">{truck.driver?.phone || '+91 98251 44821'}</span>
                </div>
                <div className="tdm-dd-row">
                  <span className="tdm-dd-label">Experience</span>
                  <span className="tdm-dd-val">{truck.driver?.experience || '8 Years'}</span>
                </div>
                <div className="tdm-dd-row">
                  <span className="tdm-dd-label">Duty Shift</span>
                  <span className="tdm-dd-val">{truck.driver?.shift || 'Morning Shift (06:00 – 14:00)'}</span>
                </div>
                <div className="tdm-dd-row">
                  <span className="tdm-dd-label">License Category</span>
                  <span className="tdm-dd-val">{truck.driver?.licenseType || 'Commercial Heavy (HMV)'}</span>
                </div>
                <div className="tdm-dd-row">
                  <span className="tdm-dd-label">Assigned Zone</span>
                  <span className="tdm-dd-val">{truck.zone || 'West Zone'}</span>
                </div>
                <div className="tdm-dd-row">
                  <span className="tdm-dd-label">Verification Status</span>
                  <span className="tdm-dd-val tdm-dd-verified">
                    <ShieldCheck size={13} /> AMC Certified &amp; Cleared
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: STOPS SEQUENCE */}
          {activeTab === 'stops' && (
            <div className="tdm-tab-content">
              <div className="tdm-stops-header">
                <div>
                  <h4>A* Optimized Stop Sequence</h4>
                  <p>Chronological waypoints for today's CVRP collection run.</p>
                </div>
                <span className="pill-counter">
                  {truck.stopsCompleted?.length || 0} / {truck.stops?.length || 0} Done
                </span>
              </div>

              <div className="tdm-stops-list">
                {truck.stops && truck.stops.length > 0 ? (
                  truck.stops.map((stop, sIdx) => {
                    const isCompleted = truck.stopsCompleted?.some(sc => sc.binName === stop.bin_name || sc.stopIdx === sIdx);
                    const isTarget = !isCompleted && truck.currentStopIdx === sIdx;

                    return (
                      <div 
                        key={sIdx} 
                        className={`tdm-stop-row ${isCompleted ? 'stop-done' : isTarget ? 'stop-current' : 'stop-pending'}`}
                      >
                        <div className="tdm-stop-num">
                          {isCompleted ? <CheckCircle2 size={15} /> : <span>{sIdx + 1}</span>}
                        </div>
                        <div className="tdm-stop-info">
                          <div className="tdm-stop-name">{stop.bin_name}</div>
                          <div className="tdm-stop-meta">
                            Fill: <strong>{Math.round(stop.fill_percent)}%</strong>
                            <span> · </span>
                            Waste: <strong>{Math.round(stop.fill_percent * 2.4)}L</strong>
                            {stop.lat && (
                              <span className="tdm-stop-coords"> · {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
                            )}
                          </div>
                        </div>
                        <div className="tdm-stop-badge">
                          {isCompleted ? (
                            <span className="tdm-sb-done">Serviced</span>
                          ) : isTarget ? (
                            <span className="tdm-sb-current">En Route</span>
                          ) : (
                            <span className="tdm-sb-pending">Queued</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="tdm-empty-state">
                    <AlertCircle size={24} />
                    <p>No active stops assigned. Generate routes first.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SPECS */}
          {activeTab === 'specs' && (
            <div className="tdm-tab-content">
              <div className="tdm-specs-grid">
                {[
                  { label: 'Vehicle Model',        val: truck.model },
                  { label: 'Registration (RTO)',   val: `${truck.plateNumber} (GJ-01 Ahmedabad)` },
                  { label: 'Compaction Mechanism', val: 'Hydraulic Ram Compactor (3:1 Ratio)' },
                  { label: 'Payload Capacity',     val: `${truck.capacityLiters || 5000} Liters` },
                  { label: 'Powertrain',           val: `${truck.fuelType} · Low Emission` },
                  { label: 'Telematics',           val: 'GPS/GLONASS Dual-Band + OBD-II' },
                  { label: 'Operating Depot',      val: truck.depotName || 'Central Municipal Hub' },
                  { label: 'Disposal Hub',         val: 'Pirana Municipal Solid Waste Complex' },
                ].map(({ label, val }) => (
                  <div key={label} className="tdm-spec-item">
                    <span className="tdm-spec-label">{label}</span>
                    <span className="tdm-spec-val">{val}</span>
                  </div>
                ))}
              </div>

              <div className="tdm-cert-card">
                <ShieldCheck size={22} className="tdm-cert-icon" />
                <div>
                  <div className="tdm-cert-title">AMC Registered Municipal Asset</div>
                  <div className="tdm-cert-sub">
                    Solid Waste Management Dept · Smart City Mission · Real-Time Compliance Monitored
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="tdm-footer">
          <div className="tdm-footer-live">
            <span className="live-dot" />
            <span>Telemetry synced with AMC Central Command</span>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
