import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  Recycle, 
  RefreshCw, 
  Truck, 
  ArrowUpRight, 
  Layers, 
  ShieldCheck, 
  FileText,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  MapPin,
  CheckCircle2,
  ScanLine,
  X,
  ExternalLink,
  Info,
  ChevronRight,
  Factory,
  ArrowRight,
  Cpu,
  Flame,
  Leaf
} from 'lucide-react';
import api from '../api';

const PRIORITY_CONFIG = {
  high:   { label: 'High Priority', color: '#f43f5e', bg: '#fff1f2', dot: '#f43f5e' },
  medium: { label: 'Medium Priority', color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  low:    { label: 'Low Priority / Informational', color: '#2563eb', bg: '#eff6ff', dot: '#2563eb' },
};

const TYPE_ICONS = {
  collection_frequency: <Truck size={16} />,
  sorting_infrastructure: <Recycle size={16} />,
  infrastructure_upgrade: <Layers size={16} />,
  fleet_rebalancing: <Truck size={16} />,
  policy: <FileText size={16} />,
};

// ── 3 Efficient Recycling Methods Database per Category ────────────────────────
const RECYCLING_METHODS_DATABASE = {
  Plastic: [
    {
      id: 'm1',
      number: '01',
      title: 'NIR Optical Sensor Sorting & Caustic Flaking',
      type: 'Mechanical Reclamation',
      icon: '🔬',
      description: 'Near-Infrared (NIR) spectroscopic sensors classify PET (#1) and HDPE (#2) bottles at 2.5 m/s belt speed. Materials are shredded into 8mm flakes, submerged in a 90°C caustic soda wash to strip adhesives, and extruded into food-grade rPET resin pellets.',
      impact: '88% Material Yield · Saves 72% energy vs. virgin polymer',
      facility: 'AMC Gyaspur Central MRF Automated Sorting Line (South Zone)'
    },
    {
      id: 'm2',
      number: '02',
      title: 'Thermal Anaerobic Pyrolysis for Soft Multilayers',
      type: 'Chemical Depolymerization',
      icon: '🔥',
      description: 'Multi-layered plastic pouches (MLP) and flexible films that cannot be mechanically sorted undergo oxygen-free thermal cracking at 450°C. Hydrocarbon polymers depolymerize into high-grade synthetic pyrolysis oil and industrial wax feedstocks.',
      impact: '100% Landfill Diversion for non-recyclable flexible packaging',
      facility: 'Pirana Industrial Co-Processing & Energy Recovery Unit'
    },
    {
      id: 'm3',
      number: '03',
      title: 'Automated 400kg Bale Densification & Closed-Loop Logistics',
      type: 'Compaction & Logistics Protocol',
      icon: '📦',
      description: 'Hydraulic horizontal twin-ram balers compress post-consumer plastic into high-density 400kg export-grade blocks with automated strapping. This slashes volumetric transport requirements by 65%, maximizing truck payload efficiency on AMC transit corridors.',
      impact: '65% Reduction in transport emissions & trip cycles',
      facility: 'Navrangpura & Bodakdev Secondary Aggregation Depots'
    }
  ],
  Organic: [
    {
      id: 'm1',
      number: '01',
      title: 'Decentralized High-Rate Biomethanation (CBG)',
      type: 'Anaerobic Microbial Digestion',
      icon: '⚡',
      description: 'Wet food waste and agricultural market residues (from Manek Chowk & APMC) are fed into anaerobic thermophilic digesters. Microbial methanogens digest volatile solids at 55°C, yielding 92% purity Compressed Bio-Gas (CBG) piped directly to municipal transit fueling.',
      impact: 'Generates ~85 kWh power & 180 kg bio-fertilizer per ton',
      facility: 'AMC Vastrapur Decentralized Biomethanation Complex'
    },
    {
      id: 'm2',
      number: '02',
      title: '21-Day Aerobic Thermophilic Windrow Composting',
      type: 'Biological Soil Nutrient Recovery',
      icon: '🌱',
      description: 'Organic greens are piled into 2-meter trapezoidal windrows, inoculated with bioculture, and turned mechanically every 4 days. Sustained internal heat (58–65°C) eliminates weed seeds and pathogens, creating certified FCO-standard organic compost for AMC public parks.',
      impact: 'Diverts 95% of wet waste · Eliminates fugitive methane emissions',
      facility: 'Gyaspur Central Municipal Composting Grounds'
    },
    {
      id: 'm3',
      number: '03',
      title: 'Black Soldier Fly Larvae (BSFL) Bioconversion',
      type: 'Insect Protein & Bio-Frass Conversion',
      icon: '🪲',
      description: 'Hermetia illucens larvae bioprocess organic slurry within 72 hours, consuming twice their body mass daily. Mature prepupae yield high-protein aquaculture feed, while insect frass is harvested as an ultra-pure organic bio-stimulant for urban agriculture.',
      impact: 'Reduces wet waste volume by 80% in 72 hours',
      facility: 'Sabarmati Riverfront Urban Ecology Demonstration Center'
    }
  ],
  Paper: [
    {
      id: 'm1',
      number: '01',
      title: 'High-Consistency Hydrapulping & Flotation De-Inking',
      type: 'Fiber Separation & Cleaning',
      icon: '💧',
      description: 'Baled office paper, newspapers, and packaging are soaked in warm hydraulic vortex vats. High-shear rotors separate cellulose fibers without breaking lengths. Micro-air bubbles in flotation cells attach to ink particles, floating them off as skimming froth.',
      impact: 'Saves 17 mature trees & 26,000L water per ton of paper recovered',
      facility: 'Regional Paper Recycling Consortium (Vapi-Ahmedabad Corridor)'
    },
    {
      id: 'm2',
      number: '02',
      title: 'Old Corrugated Container (OCC) Mill Baling',
      type: 'Industrial Cardboard Loop',
      icon: '🏭',
      description: 'Cardboard cartons from commercial corridors (C.G. Road, Bodakdev) are flattened, screened for strapping wire, and consolidated into 500kg mill-spec bales. Shipped directly to regional mills where long softwood fibers are reused in fresh kraft packaging liners.',
      impact: '98% Fiber recovery rate with under 2% reject rate',
      facility: 'Bapunagar & Nikol Commercial Consolidation Centers'
    },
    {
      id: 'm3',
      number: '03',
      title: 'Thermoformed Molded Pulp Cushion Fabrication',
      type: 'Circular Packaging Substitute',
      icon: '📦',
      description: 'Sanitized secondary paper slurry is vacuum-formed onto heated aluminum dies, producing rigid protective cushioning for electronics and fruit egg trays. Fully replaces single-use expanded polystyrene (thermocol) with 100% biodegradable molded pulp.',
      impact: 'Directly substitutes toxic expanded polystyrene (EPS)',
      facility: 'AMC Sanand Industrial Green Packaging Cluster'
    }
  ],
  Metal: [
    {
      id: 'm1',
      number: '01',
      title: 'Electromagnetic Overband & Eddy Current Separation',
      type: 'Continuous Ferrous / Non-Ferrous Sorting',
      icon: '🧲',
      description: 'A two-stage separator passes commingled dry waste beneath a permanent neodymium belt magnet to extract tin cans and ferrous scraps. Next, a high-frequency alternating magnetic rotor repels non-ferrous aluminum cans into segregated recovery bins at 99.5% purity.',
      impact: '99.5% Separation purity with zero manual touchpoints',
      facility: 'AMC Gyaspur Heavy Material Recovery Facility'
    },
    {
      id: 'm2',
      number: '02',
      title: 'Secondary Induction Smelting & Ingot Casting',
      type: 'Low-Emission Metallurgical Recovery',
      icon: '🔥',
      description: 'Degreased aluminum beverage cans and clean scrap are loaded into medium-frequency electric induction furnaces. Melting recycled aluminum requires only 5% of the energy and generates 95% fewer greenhouse gases compared to primary smelting from bauxite ore.',
      impact: '95% Reduction in embodied carbon & energy consumption',
      facility: 'Bapunagar Scrap Metallurgical Foundry Hub'
    },
    {
      id: 'm3',
      number: '03',
      title: 'High-Pressure Hydraulic Scrap Briquetting',
      type: 'Foundry Densification Protocol',
      icon: '🔩',
      description: 'Light gauge aluminum shavings and food cans are pressed at 3,000 PSI into dense hockey-puck briquettes. Eliminates oxidation burn loss when submerged in molten metal, maximizing foundry recovery yields to 98.2%.',
      impact: 'Zero material degradation across infinite recycling cycles',
      facility: 'East Zone Scrap Aggregation Depot (Nikol)'
    }
  ],
  Mixed: [
    {
      id: 'm1',
      number: '01',
      title: 'Source-Segregated Dual-Stream Collection Protocol',
      type: 'At-Source Segregation Architecture',
      icon: '♻️',
      description: 'Mandating twin-compartment bins (Green for Biodegradable Wet, Blue for Recyclable Dry) at residential and commercial nodes. Eliminates cross-contamination of paper and plastic by food grease, preserving up to 80% of dry waste market value.',
      impact: 'Prevents 40% secondary contamination reject rate at MRFs',
      facility: 'AMC City-Wide Municipal Ward Deployment Standard'
    },
    {
      id: 'm2',
      number: '02',
      title: 'Trommel Screening & Ballistic Material Separation',
      type: 'Automated Density & Size Fractionation',
      icon: '🌀',
      description: 'Commingled dry waste passes through a rotary trommel with graduated 50mm and 120mm screens to eliminate fines and grit. Ballistic separators bounce rigid plastics and cans upward while flexible films and paper travel downward along angled paddle belts.',
      impact: 'Triples processing capacity to 25 tons/hour per MRF line',
      facility: 'Gyaspur Integrated Solid Waste Processing Plant'
    },
    {
      id: 'm3',
      number: '03',
      title: 'Refuse Derived Fuel (RDF) Pelleting for Cement Kilns',
      type: 'Non-Recyclable Residual Energy Recovery',
      icon: '⚡',
      description: 'Non-recyclable combustible residuals (soiled paper, cloth, non-chlorinated plastic film) are shredded, dried to <15% moisture, and pelletized into RDF with a calorific value of 3,200 kcal/kg. Dispatched as a clean coal replacement to regional Gujarat cement kilns.',
      impact: 'Zero-landfill residue: 100% thermal recovery in cement kilns',
      facility: 'Pirana Waste-to-Energy (WtE) & RDF Processing Complex'
    }
  ]
};

function getMethodsForCategory(category) {
  if (!category) return RECYCLING_METHODS_DATABASE.Mixed;
  const cat = category.toLowerCase();
  if (cat.includes('plastic')) return RECYCLING_METHODS_DATABASE.Plastic;
  if (cat.includes('organic')) return RECYCLING_METHODS_DATABASE.Organic;
  if (cat.includes('paper')) return RECYCLING_METHODS_DATABASE.Paper;
  if (cat.includes('metal')) return RECYCLING_METHODS_DATABASE.Metal;
  return RECYCLING_METHODS_DATABASE.Mixed;
}

// ── Leaflet Helper: Fly/Recenter Map to Zone Center ──────────────────────────
function MapCenterController({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

// ── Custom Marker Icon Generator ──────────────────────────────────────────────
function getDirectiveMarkerIcon(fill) {
  const color = fill >= 80 ? '#f43f5e' : (fill >= 50 ? '#f59e0b' : '#10b981');
  return L.divIcon({
    className: 'directive-bin-marker-wrap',
    html: `
      <div style="
        background: ${color};
        color: #ffffff;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 16px;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 14px ${color}80;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      ">
        <span style="font-size: 10px;">🗑️</span>
        <span>${Math.round(fill)}%</span>
      </div>
    `,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
    popupAnchor: [0, -14],
  });
}

// ── Suggestion Card Component (Main List) ────────────────────────────────────
function DirectiveCard({ s, onClick }) {
  const cfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.low;
  return (
    <div 
      className="directive-card-clickable" 
      onClick={() => onClick(s)}
      title="Click to view interactive zone map and 3 efficient recycling methods"
    >
      <div className="kpi-card-glow-bg" style={{ background: cfg.color, opacity: 0.12 }}></div>
      <div className="directive-card-inner">
        <div className="suggestion-top-row">
          <div className="suggestion-icon-wrap" style={{ color: cfg.color, background: cfg.bg }}>
            {TYPE_ICONS[s.type] || <ShieldCheck size={16} />}
          </div>
          <div className="suggestion-meta">
            <span className="suggestion-zone-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={11} /> {s.zone}
            </span>
            <span className="suggestion-category-tag">{s.category}</span>
            <span className="suggestion-priority-pill" style={{ background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}33` }}>
              <span className="priority-dot" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          </div>
          <span className="suggestion-metric-chip">{s.metric}</span>
        </div>

        <div className="suggestion-action-text">
          <span className="suggestion-emoji">{s.icon}</span>
          {s.action}
        </div>

        <div className="directive-bottom-action-row">
          <div className="suggestion-impact-row">
            <ArrowUpRight size={13} style={{ color: '#10b981' }} />
            <span className="suggestion-impact-text">{s.impact_estimate}</span>
          </div>
          <div className="directive-explore-pill">
            <span>Explore Zone Map &amp; 3 Recycling Methods</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Interactive Directive Popup Modal ─────────────────────────────────────────
function DirectiveModal({ directive, bins, onClose }) {
  const navigate = useNavigate();

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter bins associated with this directive's zone
  const zoneBins = useMemo(() => {
    if (!directive || !bins || bins.length === 0) return [];
    return bins.filter(b => {
      if (!b.zone) return false;
      const bZone = b.zone.toLowerCase();
      const dZone = (directive.zone || '').toLowerCase();
      return bZone.includes(dZone) || dZone.includes(bZone);
    });
  }, [directive, bins]);

  // Priority styling configuration
  const cfg = PRIORITY_CONFIG[directive?.priority] || PRIORITY_CONFIG.low;

  // Retrieve 3 deep-dive engineering recycling methods for this category
  const methods = getMethodsForCategory(directive?.category);

  // Derive zone centroid for Leaflet camera re-centering
  const mapCenter = useMemo(() => {
    if (zoneBins.length === 0) return [23.0225, 72.5714]; // Central Ahmedabad fallback
    const sumLat = zoneBins.reduce((acc, b) => acc + b.lat, 0);
    const sumLng = zoneBins.reduce((acc, b) => acc + b.lng, 0);
    return [sumLat / zoneBins.length, sumLng / zoneBins.length];
  }, [zoneBins]);

  // Calculate zone capacity and critical fill bins
  const totalZoneCap = zoneBins.reduce((acc, b) => acc + (b.capacity_liters || 240), 0);
  const avgZoneFill = zoneBins.length > 0 
    ? Math.round(zoneBins.reduce((acc, b) => acc + (b.current_fill_percent || 0), 0) / zoneBins.length)
    : 0;
  const criticalZoneBins = zoneBins.filter(b => (b.current_fill_percent || 0) >= 80);

  if (!directive) return null;

  return (
    <div className="directive-modal-overlay" onClick={onClose}>
      <div className="directive-modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="directive-modal-header">
          <div className="dm-header-left">
            <div className="dm-zone-badge">
              <MapPin size={13} style={{ color: '#2563eb' }} />
              <span>{directive.zone}</span>
              <span className="dm-zone-dot">•</span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{zoneBins.length} Monitored Bins</span>
            </div>
            <h2 className="dm-title">{directive.category} Material Diversion Strategy</h2>
            <div className="dm-header-pills">
              <span className="suggestion-priority-pill" style={{ background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}33` }}>
                <span className="priority-dot" style={{ background: cfg.dot }} />
                {cfg.label}
              </span>
              <span className="dm-metric-chip">{directive.metric}</span>
            </div>
          </div>
          <button className="dm-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="directive-modal-body">

          {/* Action Overview Notice */}
          <div className="dm-action-banner" style={{ border: `1px solid ${cfg.color}40`, background: `${cfg.color}08`, borderRadius: '14px' }}>
            <div className="dm-action-icon">{directive.icon}</div>
            <div className="dm-action-text">
              <strong>Action Directive:</strong> {directive.action}
              <div className="dm-action-impact">
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                <span><strong>Impact Projection:</strong> {directive.impact_estimate}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Interactive Map + Zone Telemetry Split Grid */}
          <div className="dm-section-heading">
            <MapPin size={16} style={{ color: '#2563eb' }} />
            <h3>Zone Sensor Grid &amp; Monitored Landmark Bins</h3>
          </div>

          <div className="directive-split-grid">
            {/* Left: Interactive Leaflet Map */}
            <div className="directive-map-wrap">
              <MapContainer
                center={mapCenter}
                zoom={directive.zone === 'All Zones' ? 12 : 14}
                style={{ height: '100%', width: '100%', borderRadius: '14px' }}
                scrollWheelZoom={true}
              >
                <MapCenterController center={mapCenter} zoom={directive.zone === 'All Zones' ? 12 : 14} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
                {zoneBins.map(bin => {
                  if (!bin.lat || !bin.lng) return null;
                  const fill = bin.current_fill_percent || 0;
                  const fillColor = fill >= 80 ? '#f43f5e' : (fill >= 50 ? '#f59e0b' : '#10b981');
                  return (
                    <Marker
                      key={bin.id}
                      position={[bin.lat, bin.lng]}
                      icon={getDirectiveMarkerIcon(fill)}
                    >
                      <Popup className="modern-map-popup">
                        <div style={{ fontSize: '12px', lineHeight: '1.5', minWidth: '170px' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{bin.name}</strong><br />
                          <span style={{ color: '#64748b' }}>{bin.zone}</span><br />
                          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                            <strong>Waste Type:</strong> {bin.waste_type}<br />
                            <strong>Capacity:</strong> {bin.capacity_liters || 240} Liters<br />
                            <strong>Current Fill:</strong> <span style={{ color: fillColor, fontWeight: 700 }}>{Math.round(fill)}%</span>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Right: Zone Telemetry Panel */}
            <div className="directive-bins-telemetry">
              <div className="dbt-top-stats">
                <div className="dbt-stat-box">
                  <span className="dbt-stat-val">{zoneBins.length}</span>
                  <span className="dbt-stat-lbl">Zone Bins</span>
                </div>
                <div className="dbt-stat-box">
                  <span className="dbt-stat-val" style={{ color: avgZoneFill >= 70 ? '#f43f5e' : '#2563eb' }}>{avgZoneFill}%</span>
                  <span className="dbt-stat-lbl">Avg Fill</span>
                </div>
                <div className="dbt-stat-box">
                  <span className="dbt-stat-val" style={{ color: criticalZoneBins.length > 0 ? '#f43f5e' : '#10b981' }}>{criticalZoneBins.length}</span>
                  <span className="dbt-stat-lbl">Critical (&gt;80%)</span>
                </div>
              </div>

              <div className="dbt-list-title">Monitored Bins in {directive.zone}</div>
              <div className="dbt-bins-scroll">
                {zoneBins.map(bin => {
                  const fill = bin.current_fill_percent || 0;
                  const fillColor = fill >= 80 ? '#f43f5e' : (fill >= 50 ? '#f59e0b' : '#10b981');
                  return (
                    <div key={bin.id} className="dbt-bin-item">
                      <div className="dbt-bin-info">
                        <span className="dbt-bin-name" title={bin.name}>{bin.name}</span>
                        <span className="dbt-bin-sub">{bin.waste_type} · {bin.capacity_liters || 240}L</span>
                      </div>
                      <div className="dbt-bin-meter">
                        <span className="dbt-bin-pct" style={{ color: fillColor }}>{Math.round(fill)}%</span>
                        <div className="dbt-mini-bar-wrap">
                          <div className="dbt-mini-bar-fill" style={{ width: `${Math.min(fill, 100)}%`, background: fillColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: 3 Separate Boxes for Efficient Recycling Methods */}
          <div className="dm-section-heading" style={{ marginTop: '12px' }}>
            <Recycle size={18} style={{ color: '#10b981' }} />
            <div>
              <h3>How to Recycle This Waste Stream Efficiently</h3>
              <p className="dm-section-sub">
                Official circular recovery protocols for <strong>{directive.category}</strong> waste to achieve maximum landfill diversion.
              </p>
            </div>
          </div>

          <div className="directive-methods-grid">
            {methods.map(m => (
              <div key={m.id} className="directive-method-box">
                <div className="dmb-top">
                  <span className="dmb-num-badge">METHOD {m.number}</span>
                  <span className="dmb-type-tag">{m.type}</span>
                </div>
                <div className="dmb-title-row">
                  <span className="dmb-icon">{m.icon}</span>
                  <h4 className="dmb-title">{m.title}</h4>
                </div>
                <p className="dmb-desc">{m.description}</p>
                <div className="dmb-footer">
                  <div className="dmb-impact-badge">
                    <ArrowUpRight size={13} style={{ color: '#10b981' }} />
                    <span>{m.impact}</span>
                  </div>
                  <div className="dmb-facility">
                    <Factory size={12} />
                    <span>{m.facility}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Bottom Actions */}
          <div className="dm-modal-footer">
            <button className="btn btn-secondary" onClick={() => navigate('/fleet')}>
              <Truck size={15} />
              <span>Dispatch Route for This Zone</span>
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              <CheckCircle2 size={15} />
              <span>Done / Back to Directives</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Main Recycling Page Component ─────────────────────────────────────────────
export default function RecyclingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDirective, setSelectedDirective] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resSugg, resBins] = await Promise.all([
        api.get('/recycling/suggestions'),
        api.get('/bins')
      ]);
      setData(resSugg.data);
      setBins(resBins.data || []);
    } catch (err) {
      console.error('Failed to fetch recycling suggestions or bins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const suggestions = data?.suggestions || [];
  const summary = data?.summary || {};

  const filtered = filter === 'all'
    ? suggestions
    : suggestions.filter(s => s.priority === filter);

  const highCount = suggestions.filter(s => s.priority === 'high').length;
  const medCount = suggestions.filter(s => s.priority === 'medium').length;
  const infoCount = suggestions.filter(s => s.priority === 'low').length;

  return (
    <div className="recycling-page-wrapper">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="header-titles">
          <div className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} style={{ color: '#10b981' }} />
            Circular AI · Material Recovery Directives
          </div>
          <h1 className="editorial-title">
            AI Recycling &amp; <em>Sustainability</em> Directives
          </h1>
          <p className="editorial-subtitle">
            Autonomous material segregation intelligence, dual-stream bin allocation, and automated MRF diversion policies across all 250 AMC municipal bins. Click any directive to launch interactive zone maps and technical recycling methods.
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/')}
            title="Return to Dashboard"
          >
            <span>← Back to Dashboard</span>
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => navigate('/classify')}
            title="Open AI Waste Classifier"
          >
            <ScanLine size={15} />
            <span>Classify Waste</span>
          </button>
          <button 
            className="btn btn-primary" 
            onClick={fetchData}
            disabled={loading}
            title="Refresh AI Directives"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh Directives</span>
          </button>
        </div>
      </div>

      {/* ── Top HUD KPI Matrix ────────────────────────────────────────────── */}
      <div className="hud-kpi-matrix" style={{ marginBottom: '24px' }}>
        {/* KPI 1: Monitored Bins */}
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Monitored Bins</span>
              <div className="kpi-icon-pill icon-dark"><Layers size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">{summary.total_bins || 250}</span>
              <span className="kpi-unit">Bins</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #38bdf8, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">Ahmedabad Municipal Grid across <strong>5 Zones</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 2: Critical Bins */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-coral"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag" style={{ color: '#e11d48' }}>Critical Bins</span>
              <div className="kpi-icon-pill icon-coral"><AlertTriangle size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-coral-gradient">{summary.critical_bins ?? 0}</span>
              <span className="kpi-unit-pill pill-coral">Urgent</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-coral" style={{ width: `${Math.min((summary.critical_bins || 0) * 8, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">Threshold breach <strong>&gt;80% fill</strong></span>
            </div>
          </div>
        </div>

        {/* KPI 3: Recyclable Coverage */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-emerald"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Recyclable Share</span>
              <div className="kpi-icon-pill icon-emerald"><Recycle size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-emerald-gradient">{summary.recyclability_ratio ?? 45}%</span>
              <span className="kpi-unit-pill pill-emerald">Diversion</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-emerald" style={{ width: `${summary.recyclability_ratio ?? 45}%` }}></div>
              </div>
              <span className="kpi-subtext">Plastic, paper, metal &amp; glass streams</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Active Directives */}
        <div className="hud-kpi-card">
          <div className="kpi-card-glow-bg glow-violet"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Active Directives</span>
              <div className="kpi-icon-pill icon-violet"><Sparkles size={16} /></div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-violet-gradient">{suggestions.length}</span>
              <span className="kpi-unit-pill pill-violet">{highCount > 0 ? `${highCount} Urgent` : 'Optimized'}</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-violet" style={{ width: '100%' }}></div>
              </div>
              <span className="kpi-subtext">Click any directive to inspect circular protocols</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Directives Section ────────────────────────────────────────── */}
      <div className="card recycling-panel" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-emerald">Policy &amp; Logistics Engine</div>
            <h3>Zone-by-Zone Recycling &amp; Sorting Actions</h3>
          </div>
          <div className="card-header-actions">
            {highCount > 0 && (
              <span className="suggestion-urgent-badge">{highCount} Urgent</span>
            )}
            <span className="pill-counter" style={{ background: '#eff6ff', color: '#2563eb' }}>
              {suggestions.length} Directives Available · Click Any Card
            </span>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="suggestions-loading">
              <RefreshCw size={22} className="spin" style={{ color: '#10b981' }} />
              <span>Analyzing real-time waste composition and segregation telemetry across all AMC zones...</span>
            </div>
          ) : (
            <>
              {/* Filter tabs */}
              <div className="suggestion-filter-tabs">
                {[
                  { key: 'all', label: `All Directives (${suggestions.length})` },
                  { key: 'high', label: `🔴 High Priority (${highCount})` },
                  { key: 'medium', label: `🟡 Medium Priority (${medCount})` },
                  { key: 'low', label: `🔵 Informational (${infoCount})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`filter-tab ${filter === tab.key ? 'active' : ''}`}
                    onClick={() => setFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Suggestions list */}
              <div className="suggestions-list">
                {filtered.length === 0 ? (
                  <div className="suggestions-empty">
                    <ShieldCheck size={32} style={{ color: '#10b981' }} />
                    <p>No directives currently matching this filter level.</p>
                  </div>
                ) : (
                  filtered.map(s => (
                    <DirectiveCard 
                      key={s.id} 
                      s={s} 
                      onClick={setSelectedDirective} 
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Deeply Informative MRF Diversion Standards Section ──────────────── */}
      <div className="card mrf-standards-section" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-blue">AMC Municipal Compliance · SWM Rules 2016</div>
            <h3>Material Recovery Facility (MRF) Diversion Standards &amp; Sorting Benchmarks</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--ink-muted)' }}>
              Standard operating procedures for sorting, processing, and routing segregated waste streams to certified AMC recovery hubs.
            </p>
          </div>
          <div className="card-header-actions">
            <a 
              href="https://ahmedabadcity.gov.in" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>AMC Portal</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        <div className="card-body">
          {/* Detailed Stream Cards Grid */}
          <div className="mrf-standards-grid">

            {/* Standard 1: Plastics */}
            <div className="mrf-card">
              <div className="mrf-card-top">
                <span className="mrf-stream-icon">🧴</span>
                <div>
                  <div className="mrf-standard-tag">PWM Rules 2021 · Schedule II</div>
                  <h4 className="mrf-stream-title">Rigid &amp; Flexible Polymers (Plastics)</h4>
                </div>
              </div>
              <div className="mrf-spec-item">
                <strong>AMC Facility:</strong> Gyaspur Automated MRF &amp; PET Baling Complex (South Zone)
              </div>
              <div className="mrf-spec-item">
                <strong>Target Streams:</strong> PET (#1 bottles), HDPE (#2 drums/containers), PP (#5 rigid caps), and MLP film sorting.
              </div>
              <div className="mrf-spec-item">
                <strong>Protocol:</strong> Near-Infrared (NIR) optical sorting, caustic flaking at 90°C, and closed-loop pelletizing. Non-recyclable laminates undergo anaerobic thermal pyrolysis for synthetic fuel oil.
              </div>
              <div className="mrf-progress-row">
                <div className="mrf-progress-labels">
                  <span>Landfill Diversion Target</span>
                  <strong>85% Achieved</strong>
                </div>
                <div className="mrf-progress-bar"><div className="mrf-progress-fill" style={{ width: '85%', background: '#2563eb' }} /></div>
              </div>
              <div className="mrf-card-footer">
                <span className="mrf-impact-metric">Saves 1.63 tons CO₂e / metric ton</span>
                <a 
                  href="https://cpcb.nic.in/plastic-waste-management-rules/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mrf-doc-link"
                >
                  <span>CPCB Rules</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Standard 2: Organics */}
            <div className="mrf-card">
              <div className="mrf-card-top">
                <span className="mrf-stream-icon">🥗</span>
                <div>
                  <div className="mrf-standard-tag">SWM Rules 2016 · Rule 15(v)</div>
                  <h4 className="mrf-stream-title">Wet Biodegradable &amp; Food Scraps</h4>
                </div>
              </div>
              <div className="mrf-spec-item">
                <strong>AMC Facility:</strong> Pirana Bio-Methanation &amp; Vastrapur Decentralized Composting Station
              </div>
              <div className="mrf-spec-item">
                <strong>Target Streams:</strong> Wholesale vegetable market waste (Manek Chowk, APMC), restaurant food scraps, and organic greens.
              </div>
              <div className="mrf-spec-item">
                <strong>Protocol:</strong> Segregated wet intake, anaerobic biomethanation producing 92% purity Bio-CNG for municipal transport, alongside 21-day thermophilic aerobic windrow composting (55–65°C).
              </div>
              <div className="mrf-progress-row">
                <div className="mrf-progress-labels">
                  <span>Landfill Diversion Target</span>
                  <strong>95% Achieved</strong>
                </div>
                <div className="mrf-progress-bar"><div className="mrf-progress-fill" style={{ width: '95%', background: '#10b981' }} /></div>
              </div>
              <div className="mrf-card-footer">
                <span className="mrf-impact-metric">Yields 85 kWh power &amp; FCO organic fertilizer</span>
                <a 
                  href="https://swachhbharatmission.ddws.gov.in/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mrf-doc-link"
                >
                  <span>SBM Guidelines</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Standard 3: Paper & Cardboard */}
            <div className="mrf-card">
              <div className="mrf-card-top">
                <span className="mrf-stream-icon">📄</span>
                <div>
                  <div className="mrf-standard-tag">MoHUA Circular Economy Action Plan</div>
                  <h4 className="mrf-stream-title">Corrugated Paperboard (OCC) &amp; Duplex</h4>
                </div>
              </div>
              <div className="mrf-spec-item">
                <strong>AMC Facility:</strong> Navrangpura Dry-Waste Consolidation Hub &amp; Gujarat Paper Mills
              </div>
              <div className="mrf-spec-item">
                <strong>Target Streams:</strong> Shipping cartons, newspapers, institutional paper (Gujarat University &amp; Colleges), and commercial cardboards.
              </div>
              <div className="mrf-spec-item">
                <strong>Protocol:</strong> Mechanical shredding, hydrapulping, centrifugal contaminant screening, and high-density 500kg hydraulic baling. Direct supply chain connection to regional paper recycling mills.
              </div>
              <div className="mrf-progress-row">
                <div className="mrf-progress-labels">
                  <span>Fiber Recovery Target</span>
                  <strong>90% Achieved</strong>
                </div>
                <div className="mrf-progress-bar"><div className="mrf-progress-fill" style={{ width: '90%', background: '#f59e0b' }} /></div>
              </div>
              <div className="mrf-card-footer">
                <span className="mrf-impact-metric">Saves 17 mature trees &amp; 26,000L water / ton</span>
                <a 
                  href="https://mohua.gov.in" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mrf-doc-link"
                >
                  <span>MoHUA Portal</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Standard 4: Metals */}
            <div className="mrf-card">
              <div className="mrf-card-top">
                <span className="mrf-stream-icon">🔩</span>
                <div>
                  <div className="mrf-standard-tag">NREP National Resource Efficiency Policy</div>
                  <h4 className="mrf-stream-title">Ferrous Alloys &amp; Scrap Aluminum</h4>
                </div>
              </div>
              <div className="mrf-spec-item">
                <strong>AMC Facility:</strong> Bapunagar Industrial Scrap Depot &amp; Smelting Foundries
              </div>
              <div className="mrf-spec-item">
                <strong>Target Streams:</strong> Tinplate food cans, aluminum beverage cans, structural metal scrap, and light municipal alloys.
              </div>
              <div className="mrf-spec-item">
                <strong>Protocol:</strong> Dual-stage magnetic cross-belt extractors followed by high-frequency Eddy Current Rotors. Scrap is compacted into 3,000 PSI foundry briquettes for secondary induction smelting.
              </div>
              <div className="mrf-progress-row">
                <div className="mrf-progress-labels">
                  <span>Elemental Recovery Target</span>
                  <strong>99% Achieved</strong>
                </div>
                <div className="mrf-progress-bar"><div className="mrf-progress-fill" style={{ width: '99%', background: '#8b5cf6' }} /></div>
              </div>
              <div className="mrf-card-footer">
                <span className="mrf-impact-metric">Consumes 95% less energy than primary ore</span>
                <a 
                  href="https://ahmedabadcity.gov.in" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mrf-doc-link"
                >
                  <span>AMC SWM Bylaws</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

          </div>

          {/* Official Policy Resource Toolbar */}
          <div className="mrf-resource-toolbar">
            <div className="mrf-resource-info">
              <Info size={16} style={{ color: '#2563eb' }} />
              <span>
                <strong>Official AMC Recycling Mandate:</strong> In accordance with the Ahmedabad Municipal Corporation Solid Waste Management Bylaws 2020 and CPCB directives, all bulk waste generators (&gt;100 kg/day) must implement on-site dual-stream segregation.
              </span>
            </div>
            <div className="mrf-resource-links">
              <a 
                href="https://ahmedabadcity.gov.in" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mrf-toolbar-btn"
              >
                <span>AMC SWM Rules (PDF)</span>
                <ExternalLink size={12} />
              </a>
              <a 
                href="https://cpcb.nic.in" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mrf-toolbar-btn"
              >
                <span>CPCB Guidelines</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* ── Directive Interactive Modal Popup ─────────────────────────────── */}
      {selectedDirective && (
        <DirectiveModal
          directive={selectedDirective}
          bins={bins}
          onClose={() => setSelectedDirective(null)}
        />
      )}

    </div>
  );
}
