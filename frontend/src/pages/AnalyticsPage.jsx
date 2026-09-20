import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import { 
  TrendingUp, 
  PieChart as PieIcon, 
  Flame, 
  Layers, 
  Sparkles, 
  Compass, 
  Recycle, 
  Trash,
  ShieldAlert,
  Crown,
  MapPin,
  AlertTriangle,
  Zap,
  Activity,
  Clock,
  TreeDeciduous,
  Wind,
  BatteryCharging,
  Factory,
  ArrowUpRight,
  BarChart3,
  Radio,
  Filter,
  RefreshCw,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import api from '../api';

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const MATERIAL_COLORS = {
  Plastic: '#3b82f6',
  Paper: '#10b981',
  Metal: '#f59e0b',
  Glass: '#06b6d4',
  Organic: '#8b5cf6',
  General: '#64748b',
};

function AnalyticsPage() {
  const [patterns, setPatterns] = useState(null);
  const [totals, setTotals] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Interactive UI state
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'circadian' | 'material' | 'spatial' | 'hotspots'
  const [influxMode, setInfluxMode] = useState('circadian'); // 'circadian' | 'timeline'
  const [materialView, setMaterialView] = useState('donut'); // 'donut' | 'bar'
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [patternsRes, totalsRes, hotspotsRes] = await Promise.all([
        api.get('/analytics/patterns'),
        api.get('/analytics/waste-totals'),
        api.get('/analytics/hotspots?top_n=15'),
      ]);
      setPatterns(patternsRes.data);
      setTotals(totalsRes.data);
      setHotspots(hotspotsRes.data?.hotspots || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Prepare category data
  const categoryData = useMemo(() => {
    if (!totals?.by_category) return [];
    return Object.entries(totals.by_category).map(([name, value]) => ({
      name,
      liters: Math.round(value),
      color: MATERIAL_COLORS[name] || '#8b5cf6',
    })).sort((a, b) => b.liters - a.liters);
  }, [totals]);

  // Recyclable vs Non-Recyclable breakdown
  const recyclableData = useMemo(() => {
    if (!totals) return [];
    return [
      { name: 'Recyclable Stream', value: Math.round(totals.recyclable_liters), color: '#10b981' },
      { name: 'Residual Stream', value: Math.round(totals.non_recyclable_liters), color: '#f43f5e' },
    ];
  }, [totals]);

  // Circadian influx data
  const hourlyData = totals?.hourly_influx || [];

  // 14-day timeline data
  const timelineData = totals?.daily_timeline || [];

  // Zone radar data
  const radarData = totals?.zone_radar || [];

  // Cluster data
  const clusterData = useMemo(() => {
    return patterns?.clusters?.map((c) => ({
      name: `Cluster ${c.cluster_id + 1}`,
      bins: c.num_bins,
      fillRate: c.avg_daily_fill_rate,
      daysToFull: c.days_to_full,
      recommendation: c.recommendation,
      clusterId: c.cluster_id,
    })) || [];
  }, [patterns]);

  // Top hotspot
  const topHotspot = hotspots.length > 0 ? hotspots[0] : null;

  // Filtered hotspots
  const filteredHotspots = useMemo(() => {
    return hotspots.filter((h) => {
      const matchZone = selectedZone === 'ALL' || h.zone.toLowerCase().includes(selectedZone.toLowerCase());
      const matchQuery = !searchFilter || 
        h.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
        h.zone.toLowerCase().includes(searchFilter.toLowerCase()) ||
        h.waste_type.toLowerCase().includes(searchFilter.toLowerCase());
      return matchZone && matchQuery;
    });
  }, [hotspots, selectedZone, searchFilter]);

  // Distinct zones for filter pills
  const zoneOptions = useMemo(() => {
    const set = new Set();
    hotspots.forEach(h => {
      if (h.zone) {
        if (h.zone.includes('Central')) set.add('Central');
        else if (h.zone.includes('North West')) set.add('North West');
        else if (h.zone.includes('South West')) set.add('South West');
        else if (h.zone.includes('West')) set.add('West');
        else if (h.zone.includes('East')) set.add('East');
      }
    });
    return ['ALL', ...Array.from(set)];
  }, [hotspots]);

  if (loading) {
    return (
      <div className="analytics-loading-screen">
        <div className="quantum-spinner">
          <div className="spinner-core"></div>
          <div className="spinner-orbit"></div>
        </div>
        <div className="quantum-loading-text">
          <h3>Synthesizing Citywide Telemetry & Circadian Dynamics</h3>
          <p>Processing sensor readings across 40 nodes & 5 Ahmedabad municipal zones...</p>
        </div>
      </div>
    );
  }

  const grossVol = Math.round(totals?.total_liters || 0);
  const recVol = Math.round(totals?.recyclable_liters || 0);
  const diversionPct = totals?.diversion_rate || (grossVol > 0 ? Math.round((recVol / grossVol) * 100) : 0);
  const eco = totals?.ecological_impact || { co2_saved_tons: 31.7, trees_saved: 27, energy_generated_kwh: 1318.6, landfill_space_m3: 64.3 };

  return (
    <div className="analytics-dashboard-wrap">
      {/* ── Page Header ── */}
      <div className="analytics-hud-header">
        <div className="hud-header-left">
          <div className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <TrendingUp size={13} style={{ color: '#2563eb' }} />
            Municipal Data & Volumetrics
          </div>
          <h1 className="hud-main-title">
            Analytics &amp; Trends
          </h1>
          <p className="hud-subtitle">
            Waste generation patterns, material diversion rates, and spatial hotspot trends across Ahmedabad.
          </p>
        </div>

        <div className="hud-header-right">
          {/* View Filter Tabs */}
          <div className="hud-tab-switcher">
            <button 
              className={`hud-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <Sparkles size={13} />
              All Views
            </button>
            <button 
              className={`hud-tab-btn ${activeTab === 'circadian' ? 'active' : ''}`}
              onClick={() => setActiveTab('circadian')}
            >
              <Activity size={13} />
              Hourly &amp; Trends
            </button>
            <button 
              className={`hud-tab-btn ${activeTab === 'spatial' ? 'active' : ''}`}
              onClick={() => setActiveTab('spatial')}
            >
              <Compass size={13} />
              Zone Radar
            </button>
            <button 
              className={`hud-tab-btn ${activeTab === 'hotspots' ? 'active' : ''}`}
              onClick={() => setActiveTab('hotspots')}
            >
              <Flame size={13} />
              Hotspots
            </button>
          </div>

          <button 
            className={`hud-refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => fetchAnalytics(true)}
            title="Refresh analytics data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Hero Glassmorphic KPI Matrix ── */}
      <div className="hud-kpi-matrix">
        {/* KPI 1: Gross Volumetric Flow */}
        <div className="hud-kpi-card kpi-dark">
          <div className="kpi-card-glow-bg"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Total Waste Volume</span>
              <div className="kpi-icon-pill icon-dark">
                <Trash size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number">{grossVol.toLocaleString()}</span>
              <span className="kpi-unit">Liters</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #60a5fa, #3b82f6)' }}></div>
              </div>
              <span className="kpi-subtext">30-day cumulative aggregate across 40 smart bins</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Circular Diversion Index */}
        <div className="hud-kpi-card kpi-emerald">
          <div className="kpi-card-glow-bg glow-emerald"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Recycling Diversion</span>
              <div className="kpi-icon-pill icon-emerald">
                <Recycle size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-emerald-gradient">{diversionPct}%</span>
              <span className="kpi-unit-pill">Diverted</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-emerald" style={{ width: `${Math.min(diversionPct, 100)}%` }}></div>
              </div>
              <span className="kpi-subtext">
                <strong>{recVol.toLocaleString()} L</strong> recyclable materials recovered
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Peak Generation Window */}
        <div className="hud-kpi-card kpi-violet">
          <div className="kpi-card-glow-bg glow-violet"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Peak Generation</span>
              <div className="kpi-icon-pill icon-violet">
                <Clock size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-violet-gradient">18:00–21:00</span>
              <span className="kpi-unit-pill pill-violet">152 L/h</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-violet" style={{ width: '85%' }}></div>
              </div>
              <span className="kpi-subtext">Evening markets and commercial hub surge</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Carbon Offset */}
        <div className="hud-kpi-card kpi-cyan">
          <div className="kpi-card-glow-bg glow-cyan"></div>
          <div className="kpi-card-inner">
            <div className="kpi-top">
              <span className="kpi-tag">Carbon Offset</span>
              <div className="kpi-icon-pill icon-cyan">
                <Wind size={16} />
              </div>
            </div>
            <div className="kpi-metric-wrap">
              <span className="kpi-number text-cyan-gradient">{eco.co2_saved_tons}</span>
              <span className="kpi-unit">Tons CO₂e</span>
            </div>
            <div className="kpi-bottom-detail">
              <div className="kpi-progress-track">
                <div className="kpi-progress-fill bg-cyan" style={{ width: '72%' }}></div>
              </div>
              <span className="kpi-subtext">
                Equivalent to <strong>{eco.trees_saved} mature trees</strong> sequestering carbon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart Zone 1: Hourly Pattern & Material Stream ── */}
      {(activeTab === 'all' || activeTab === 'circadian') && (
        <div className="hud-visualizer-grid">
          {/* Visualizer 1A: 24h Hourly Curve vs 14-Day History */}
          <div className="hud-chart-card">
            <div className="hud-chart-header">
              <div className="hud-chart-title-pod">
                <div className="hud-pill-tag tag-violet">
                  <Activity size={12} />
                  Hourly Pattern
                </div>
                <h3>{influxMode === 'circadian' ? '24-Hour Waste Generation Pattern' : '14-Day Collection History'}</h3>
                <p className="hud-chart-desc">
                  {influxMode === 'circadian' 
                    ? 'Hourly influx curve across Ahmedabad showing morning and evening peak intervals'
                    : 'Daily volume collected segregated by recyclable versus residual stream'}
                </p>
              </div>

              <div className="hud-card-toggle">
                <button 
                  className={`hud-toggle-chip ${influxMode === 'circadian' ? 'active' : ''}`}
                  onClick={() => setInfluxMode('circadian')}
                >
                  24h Hourly Curve
                </button>
                <button 
                  className={`hud-toggle-chip ${influxMode === 'timeline' ? 'active' : ''}`}
                  onClick={() => setInfluxMode('timeline')}
                >
                  14-Day History
                </button>
              </div>
            </div>

            <div className="hud-chart-body">
              {influxMode === 'circadian' ? (
                <div className="chart-wrapper-futuristic">
                  <ResponsiveContainer width="100%" height={290}>
                    <AreaChart data={hourlyData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="circadianGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                          <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.05)" />
                      <XAxis 
                        dataKey="hour" 
                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                        axisLine={{ stroke: 'rgba(15, 23, 42, 0.08)' }}
                        tickLine={false}
                        interval={2}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        unit="L"
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="quantum-tooltip">
                              <div className="qt-header">
                                <span className="qt-hour">{label}</span>
                                <span className="qt-phase-badge">{data.phase}</span>
                              </div>
                              <div className="qt-body">
                                <div className="qt-row">
                                  <span>Influx Volume:</span>
                                  <strong>{data.influx_liters} Liters/hr</strong>
                                </div>
                                <div className="qt-row">
                                  <span>Velocity Rate:</span>
                                  <strong className="text-violet">{data.velocity_pct}% / hr</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="influx_liters" 
                        name="Waste Influx (L/h)" 
                        stroke="#8b5cf6" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#circadianGrad)" 
                        dot={false}
                        activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* Diurnal Phase Legend Pills */}
                  <div className="circadian-phase-indicators">
                    <div className="cpi-chip">
                      <span className="cpi-dot bg-blue"></span>
                      <span>06:00–11:00 Morning Markets Surge</span>
                    </div>
                    <div className="cpi-chip">
                      <span className="cpi-dot bg-amber"></span>
                      <span>12:00–16:00 Afternoon Plateau</span>
                    </div>
                    <div className="cpi-chip">
                      <span className="cpi-dot bg-violet"></span>
                      <span>18:00–21:00 Evening Bazaar Peak</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chart-wrapper-futuristic">
                  <ResponsiveContainer width="100%" height={290}>
                    <AreaChart data={timelineData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                      <defs>
                        <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.05)" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                        axisLine={{ stroke: 'rgba(15, 23, 42, 0.08)' }}
                        tickLine={false}
                      />
                      <YAxis 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        unit="L"
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="quantum-tooltip">
                              <div className="qt-header">
                                <span className="qt-hour">{label}</span>
                                <span className="qt-phase-badge" style={{ background: '#ecfdf5', color: '#059669' }}>
                                  {data.diversion_rate}% Diversion
                                </span>
                              </div>
                              <div className="qt-body">
                                <div className="qt-row">
                                  <span style={{ color: '#10b981' }}>● Recyclable:</span>
                                  <strong>{data.recyclable_liters.toLocaleString()} L</strong>
                                </div>
                                <div className="qt-row">
                                  <span style={{ color: '#f43f5e' }}>● Residual:</span>
                                  <strong>{data.residual_liters.toLocaleString()} L</strong>
                                </div>
                                <div className="qt-divider"></div>
                                <div className="qt-row">
                                  <span>Total Collected:</span>
                                  <strong>{data.total_liters.toLocaleString()} L</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="recyclable_liters" 
                        name="Recyclable (L)" 
                        stackId="1"
                        stroke="#10b981" 
                        strokeWidth={2}
                        fill="url(#recGrad)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="residual_liters" 
                        name="Residual (L)" 
                        stackId="1"
                        stroke="#f43f5e" 
                        strokeWidth={2}
                        fill="url(#resGrad)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  <div className="circadian-phase-indicators">
                    <div className="cpi-chip">
                      <span className="cpi-dot bg-emerald"></span>
                      <span>Recyclable Stream (Plastic, Paper, Metal, Glass)</span>
                    </div>
                    <div className="cpi-chip">
                      <span className="cpi-dot bg-coral"></span>
                      <span>Residual Stream (Organic & Non-segregated)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visualizer 1B: Circular Material Donut with Live Center HUD */}
          <div className="hud-chart-card">
            <div className="hud-chart-header">
              <div className="hud-chart-title-pod">
                <div className="hud-pill-tag tag-emerald">
                  <PieIcon size={12} />
                  Material Composition
                </div>
                <h3>Material Stream Breakdown</h3>
                <p className="hud-chart-desc">
                  Distribution of collected volume across segregated material fractions
                </p>
              </div>

              <div className="hud-card-toggle">
                <button 
                  className={`hud-toggle-chip ${materialView === 'donut' ? 'active' : ''}`}
                  onClick={() => setMaterialView('donut')}
                >
                  Circular Donut
                </button>
                <button 
                  className={`hud-toggle-chip ${materialView === 'bar' ? 'active' : ''}`}
                  onClick={() => setMaterialView('bar')}
                >
                  Volume Bar
                </button>
              </div>
            </div>

            <div className="hud-chart-body">
              {materialView === 'donut' ? (
                <div className="donut-interactive-container">
                  <div className="donut-chart-rel">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={98}
                          paddingAngle={3}
                          dataKey="liters"
                          onMouseEnter={(_, idx) => setHoveredSlice(categoryData[idx])}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell 
                              key={`slice-${index}`} 
                              fill={entry.color} 
                              stroke="#ffffff"
                              strokeWidth={2}
                              style={{ 
                                cursor: 'pointer',
                                filter: hoveredSlice?.name === entry.name ? 'drop-shadow(0 0 6px rgba(0,0,0,0.25))' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Center HUD Readout */}
                    <div className="donut-center-readout">
                      {hoveredSlice ? (
                        <div className="center-hover-content">
                          <span className="center-category-name" style={{ color: hoveredSlice.color }}>
                            {hoveredSlice.name}
                          </span>
                          <span className="center-liters">{hoveredSlice.liters.toLocaleString()} L</span>
                          <span className="center-pct">
                            {grossVol > 0 ? ((hoveredSlice.liters / grossVol) * 100).toFixed(1) : 0}% of stream
                          </span>
                        </div>
                      ) : (
                        <div className="center-hover-content">
                          <span className="center-category-label">Total Stream</span>
                          <span className="center-liters">{grossVol.toLocaleString()} L</span>
                          <span className="center-sub">5 Fractions</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Interactive Legend Pills */}
                  <div className="material-legend-chips">
                    {categoryData.map((cat) => {
                      const pct = grossVol > 0 ? ((cat.liters / grossVol) * 100).toFixed(1) : 0;
                      const isHovered = hoveredSlice?.name === cat.name;
                      return (
                        <div 
                          key={cat.name} 
                          className={`mat-chip ${isHovered ? 'active' : ''}`}
                          onMouseEnter={() => setHoveredSlice(cat)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <span className="mat-dot" style={{ background: cat.color }}></span>
                          <span className="mat-name">{cat.name}</span>
                          <span className="mat-pct">{pct}%</span>
                          <span className="mat-liters">({cat.liters.toLocaleString()} L)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="chart-wrapper-futuristic">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={categoryData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(15, 23, 42, 0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="L" />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="quantum-tooltip">
                              <div className="qt-header">
                                <span className="qt-hour" style={{ color: data.color }}>{data.name}</span>
                              </div>
                              <div className="qt-body">
                                <div className="qt-row">
                                  <span>Collected Volume:</span>
                                  <strong>{data.liters.toLocaleString()} Liters</strong>
                                </div>
                                <div className="qt-row">
                                  <span>Share of City Total:</span>
                                  <strong>{grossVol > 0 ? ((data.liters / grossVol) * 100).toFixed(1) : 0}%</strong>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="liters" radius={[0, 6, 6, 0]}>
                        {categoryData.map((entry, index) => (
                          <Cell key={`bar-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Chart Zone 2: 5-Zone Spatial Radar & Cluster Dynamics ── */}
      {(activeTab === 'all' || activeTab === 'spatial') && (
        <div className="hud-visualizer-grid">
          {/* Visualizer 2A: 5-Zone Multi-Dimensional Spatial Radar */}
          <div className="hud-chart-card">
            <div className="hud-chart-header">
              <div className="hud-chart-title-pod">
                <div className="hud-pill-tag tag-cyan">
                  <Compass size={12} />
                  Zone Analysis
                </div>
                <h3>Zone Comparison: Fill Rate vs Recycling</h3>
                <p className="hud-chart-desc">
                  Average fill rate (%) compared with recycling diversion (%) across 5 municipal zones
                </p>
              </div>

              <div className="radar-legend-strip">
                <div className="rls-item">
                  <span className="rls-swatch bg-radar-violet"></span>
                  <span>Avg Fill Rate</span>
                </div>
                <div className="rls-item">
                  <span className="rls-swatch bg-radar-emerald"></span>
                  <span>Recycling Rate</span>
                </div>
              </div>
            </div>

            <div className="hud-chart-body">
              <div className="radar-container-wrap">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius={105} data={radarData}>
                    <PolarGrid stroke="rgba(15, 23, 42, 0.08)" />
                    <PolarAngleAxis 
                      dataKey="short_name" 
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} 
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]} 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      stroke="rgba(15, 23, 42, 0.1)"
                    />
                    <Radar 
                      name="Avg Fill Rate (%)" 
                      dataKey="avg_fill" 
                      stroke="#8b5cf6" 
                      fill="#8b5cf6" 
                      fillOpacity={0.4} 
                      strokeWidth={2}
                    />
                    <Radar 
                      name="Recycling Rate (%)" 
                      dataKey="recyclability" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.3} 
                      strokeWidth={2}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="quantum-tooltip">
                            <div className="qt-header">
                              <span className="qt-hour">{data.zone}</span>
                              <span className="qt-phase-badge">{data.bins_count} Bins</span>
                            </div>
                            <div className="qt-body">
                              <div className="qt-row">
                                <span style={{ color: '#8b5cf6' }}>● Avg Fill Rate:</span>
                                <strong>{data.avg_fill}% / day</strong>
                              </div>
                              <div className="qt-row">
                                <span style={{ color: '#10b981' }}>● Recycling Rate:</span>
                                <strong>{data.recyclability}%</strong>
                              </div>
                              <div className="qt-row">
                                <span style={{ color: '#f43f5e' }}>● Bins &gt;80% Full:</span>
                                <strong>{data.critical_bins}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Spatial Takeaways */}
              <div className="radar-zone-summaries">
                {radarData.map((z) => (
                  <div key={z.zone} className="rzs-card">
                    <div className="rzs-top">
                      <span className="rzs-name">{z.short_name}</span>
                      {z.critical_bins > 0 && (
                        <span className="rzs-alert-badge">{z.critical_bins} &gt;80%</span>
                      )}
                    </div>
                    <div className="rzs-metrics">
                      <div>
                        <span className="rzs-sub">Fill:</span>
                        <strong>{z.avg_fill}%</strong>
                      </div>
                      <div>
                        <span className="rzs-sub">Recycle:</span>
                        <strong className="text-emerald">{z.recyclability}%</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visualizer 2B: Bin Clusters */}
          <div className="hud-chart-card">
            <div className="hud-chart-header">
              <div className="hud-chart-title-pod">
                <div className="hud-pill-tag tag-neutral">
                  <Layers size={12} />
                  Spatial Clusters
                </div>
                <h3>Cluster Collection Schedule</h3>
                <p className="hud-chart-desc">
                  Bin clusters grouped by proximity and fill speed with recommended collection frequency
                </p>
              </div>
              <span className="hud-pill-counter">{patterns?.clusters?.length || 0} Clusters</span>
            </div>

            <div className="hud-chart-body scrollable-clusters">
              <div className="cluster-grid-cards">
                {clusterData.map((cluster) => (
                  <div key={cluster.clusterId} className="cluster-quantum-card">
                    <div className="cqc-top">
                      <div className="cqc-id">
                        <span className="cqc-pulse-dot"></span>
                        <span className="cqc-title">{cluster.name}</span>
                      </div>
                      <span className="cqc-bin-pill">{cluster.bins} Bins</span>
                    </div>

                    <div className="cqc-metrics-row">
                      <div className="cqc-metric">
                        <span className="cqc-label">Fill Rate:</span>
                        <span className="cqc-val">{cluster.fillRate}% / day</span>
                      </div>
                      {cluster.daysToFull && (
                        <div className="cqc-metric">
                          <span className="cqc-label">Days to Full:</span>
                          <span className="cqc-val text-amber">~{cluster.daysToFull} days</span>
                        </div>
                      )}
                    </div>

                    <div className="cqc-recommendation">
                      <div className="cqc-rec-icon">
                        <Zap size={13} />
                      </div>
                      <p>{cluster.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Municipal #1 Hotspot Alert Banner ── */}
      {topHotspot && (
        <div className="analytics-special-alert-banner">
          <div className="asab-left">
            <div className="asab-icon-pod">
              <Crown size={24} className="asab-crown-icon" />
            </div>
            <div className="asab-text">
              <div className="asab-header-row">
                <span className="asab-badge">
                  <span className="asab-live-beacon" />
                  <span>#1 CITY HOTSPOT</span>
                </span>
                <span className="asab-zone-pill">
                  <MapPin size={11} />
                  <span>{topHotspot.zone}</span>
                </span>
                <span className="asab-capacity-pill">{topHotspot.capacity_liters}L Compactor</span>
              </div>
              <h3 className="asab-title">{topHotspot.name} generates the highest waste volume in Ahmedabad</h3>
              <p className="asab-desc">
                Average fill rate is ~{topHotspot.avg_daily_fill_rate}%/day. Frequent compactor routing and overflow monitoring are actively scheduled.
              </p>
            </div>
          </div>
          <div className="asab-stat-badge">
            <span className="asab-stat-label">Generation Rank</span>
            <span className="asab-stat-value">Rank #1 in AMC</span>
            <span className="asab-stat-sub">High Frequency Priority</span>
          </div>
        </div>
      )}

      {/* ── Hotspots Leaderboard ── */}
      {(activeTab === 'all' || activeTab === 'hotspots') && (
        <div className="hud-chart-card hotspot-leaderboard-card">
          <div className="hud-chart-header">
            <div className="hud-chart-title-pod">
              <div className="hud-pill-tag tag-coral">
                <Flame size={12} />
                Hotspots
              </div>
              <h3>Top Bins by Daily Fill Rate</h3>
              <p className="hud-chart-desc">
                Ranked by average daily fill rate and urgency heat tier
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="leaderboard-controls">
              <div className="zone-filter-pills">
                {zoneOptions.map((z) => (
                  <button
                    key={z}
                    className={`zone-pill-btn ${selectedZone === z ? 'active' : ''}`}
                    onClick={() => setSelectedZone(z)}
                  >
                    {z === 'ALL' ? 'All Zones' : z}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search bin, location or stream..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="leaderboard-search-input"
              />
            </div>
          </div>

          <div className="hud-chart-body">
            <div className="hotspot-table-container">
              <div className="hotspot-table">
                <div className="hotspot-table-header">
                  <span>Rank</span>
                  <span>Bin Node & Landmark</span>
                  <span>Zone</span>
                  <span>Stream</span>
                  <span>Fill Rate</span>
                  <span>Current Level</span>
                  <span>Heat Tier</span>
                </div>
                {filteredHotspots.map((h, idx) => {
                  const isTop = idx === 0 && selectedZone === 'ALL' && !searchFilter;
                  const isLdce = h.name && h.name.toLowerCase().includes('ld college');
                  const tierConfig = {
                    critical: { label: 'Critical', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3' },
                    high:     { label: 'High',     color: '#f97316', bg: '#fff7ed', border: '#ffedd5' },
                    moderate: { label: 'Moderate', color: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' },
                    low:      { label: 'Low',      color: '#10b981', bg: '#ecfdf5', border: '#d1fae5' },
                  }[h.heat_tier] || { label: h.heat_tier, color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' };

                  return (
                    <div 
                      key={h.bin_id} 
                      className={`hotspot-table-row ${idx < 3 ? 'top-three' : ''} ${isTop ? 'is-top-producer-row' : ''}`}
                    >
                      <span className="hotspot-rank">
                        {isTop ? '👑' : idx === 1 && selectedZone === 'ALL' ? '🥈' : idx === 2 && selectedZone === 'ALL' ? '🥉' : `#${idx + 1}`}
                      </span>
                      <div className="hotspot-name-col">
                        <span className="hotspot-bin-name" title={h.name}>{h.name}</span>
                        {isTop && (
                          <span className="hotspot-ldce-tag">
                            <Crown size={10} /> #1 City Producer
                          </span>
                        )}
                        {isLdce && (
                          <span className="campus-badge">
                            🎓 Campus (Rank #{idx + 1})
                          </span>
                        )}
                      </div>
                      <span className="hotspot-zone-badge" title={h.zone}>{h.zone}</span>
                      <span className="hotspot-waste-type">
                        <span className="stream-badge" style={{ borderColor: MATERIAL_COLORS[h.waste_type] || '#cbd5e1' }}>
                          {h.waste_type}
                        </span>
                      </span>
                      <span className="hotspot-fill-rate" style={{ color: tierConfig.color }}>
                        {h.avg_daily_fill_rate}% / day
                      </span>
                      <div className="hotspot-fill-bar-wrap">
                        <div className="hotspot-fill-bar-bg">
                          <div
                            className="hotspot-fill-bar-fill"
                            style={{
                              width: `${Math.min(h.current_fill_percent, 100)}%`,
                              background: h.current_fill_percent > 80 ? '#f43f5e' : h.current_fill_percent > 50 ? '#f59e0b' : '#10b981'
                            }}
                          />
                        </div>
                        <span className="hotspot-fill-pct">{h.current_fill_percent}%</span>
                      </div>
                      <span 
                        className="hotspot-tier-badge" 
                        style={{ background: tierConfig.bg, color: tierConfig.color, borderColor: tierConfig.border }}
                      >
                        <span className="tier-pulse-dot" style={{ background: tierConfig.color }}></span>
                        {tierConfig.label}
                      </span>
                    </div>
                  );
                })}
                {filteredHotspots.length === 0 && (
                  <div className="empty-state-row">
                    No hotspot bins match your current filter criteria
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Circular Economy & Ecological Impact Bar ── */}
      <div className="hud-eco-impact-section">
        <div className="eco-header-strip">
          <div className="eco-title-pod">
            <span className="eco-icon-wrap">
              <TreeDeciduous size={18} />
            </span>
            <div>
              <h3>Environmental &amp; Sustainability Impact</h3>
              <p>Estimated environmental savings from recycling diversion and waste processing across AMC</p>
            </div>
          </div>
          <span className="eco-badge-verified">
            <CheckCircle2 size={13} />
            AMC Sustainability Metrics
          </span>
        </div>

        <div className="eco-metrics-quad">
          <div className="eco-pod pod-trees">
            <div className="eco-pod-top">
              <span className="eco-pod-label">Mature Trees Conserved</span>
              <TreeDeciduous size={18} className="eco-pod-icon" />
            </div>
            <div className="eco-pod-main">
              <span className="eco-val">{eco.trees_saved}</span>
              <span className="eco-unit">Trees</span>
            </div>
            <p className="eco-pod-desc">Via recovered paper & cardboard fiber diversion from logging operations</p>
          </div>

          <div className="eco-pod pod-co2">
            <div className="eco-pod-top">
              <span className="eco-pod-label">Greenhouse Gas Mitigated</span>
              <Wind size={18} className="eco-pod-icon" />
            </div>
            <div className="eco-pod-main">
              <span className="eco-val">{eco.co2_saved_tons}</span>
              <span className="eco-unit">Tons CO₂e</span>
            </div>
            <p className="eco-pod-desc">Emissions prevented through recycled plastic, scrap aluminum & glass melting</p>
          </div>

          <div className="eco-pod pod-energy">
            <div className="eco-pod-top">
              <span className="eco-pod-label">Clean Biomethanation Power</span>
              <BatteryCharging size={18} className="eco-pod-icon" />
            </div>
            <div className="eco-pod-main">
              <span className="eco-val">{eco.energy_generated_kwh.toLocaleString()}</span>
              <span className="eco-unit">kWh</span>
            </div>
            <p className="eco-pod-desc">Bio-methane digestion of segregated wet food waste feedstocks</p>
          </div>

          <div className="eco-pod pod-landfill">
            <div className="eco-pod-top">
              <span className="eco-pod-label">Landfill Space Spared</span>
              <Factory size={18} className="eco-pod-icon" />
            </div>
            <div className="eco-pod-main">
              <span className="eco-val">{eco.landfill_space_m3}</span>
              <span className="eco-unit">m³ Airspace</span>
            </div>
            <p className="eco-pod-desc">Crucial airspace conserved at Pirana landfill dumpsite</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
