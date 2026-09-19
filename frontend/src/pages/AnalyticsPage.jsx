import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
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
  AlertTriangle,
  Zap
} from 'lucide-react';
import api from '../api';
import RecyclingSuggestionsPanel from '../components/RecyclingSuggestionsPanel';

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4'];

function AnalyticsPage() {
  const [patterns, setPatterns] = useState(null);
  const [totals, setTotals] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [patternsRes, totalsRes, hotspotsRes] = await Promise.all([
          api.get('/analytics/patterns'),
          api.get('/analytics/waste-totals'),
          api.get('/analytics/hotspots?top_n=10'),
        ]);
        setPatterns(patternsRes.data);
        setTotals(totalsRes.data);
        setHotspots(hotspotsRes.data?.hotspots || []);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="modern-spinner"></div>
        <div className="loading-text">
          <span>Aggregating Spatial Hotspots & Historical Trends...</span>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const categoryData = totals?.by_category
    ? Object.entries(totals.by_category).map(([name, value]) => ({
        name,
        liters: Math.round(value),
      }))
    : [];

  const recyclableData = totals ? [
    { name: 'Recyclable', value: Math.round(totals.recyclable_liters) },
    { name: 'Non-Recyclable', value: Math.round(totals.non_recyclable_liters) },
  ] : [];

  const clusterData = patterns?.clusters?.map(c => ({
    name: `Cluster ${c.cluster_id + 1}`,
    bins: c.num_bins,
    fillRate: c.avg_daily_fill_rate,
  })) || [];

  const diversionRate = totals && totals.total_liters > 0
    ? Math.round((totals.recyclable_liters / totals.total_liters) * 100)
    : 0;

  return (
    <div className="page-container">
      {/* Editorial Page Header */}
      <div className="page-header-editorial">
        <div className="header-left">
          <div className="header-category-badge">
            <TrendingUp size={13} />
            Spatial Density & Volumetrics
          </div>
          <h1 className="editorial-title">
            Macro <em>intelligence</em> & hotspot clusters
          </h1>
          <p className="editorial-subtitle">
            Ahmedabad Municipal Corporation (AMC) aggregate waste volumes, recyclability diversion index, and spatial cluster dynamics.
          </p>
        </div>
      </div>

      {/* Hero Volume Banners */}
      {totals && (
        <div className="totals-grid-editorial">
          <div className="editorial-total-card card-dark">
            <div className="total-top">
              <span className="total-badge-label">Gross Volumetric Output</span>
              <Trash size={18} className="total-card-icon" />
            </div>
            <div className="total-main-number">
              {Math.round(totals.total_liters).toLocaleString()}
              <span className="unit-text">L</span>
            </div>
            <div className="total-footer-info">
              Cumulative collected volume across 40 AMC smart telemetry bins
            </div>
          </div>

          <div className="editorial-total-card card-emerald">
            <div className="total-top">
              <span className="total-badge-label">Recyclable Diversion</span>
              <Recycle size={18} className="total-card-icon" />
            </div>
            <div className="total-main-number text-emerald">
              {Math.round(totals.recyclable_liters).toLocaleString()}
              <span className="unit-text">L</span>
            </div>
            <div className="total-footer-info">
              <strong>{diversionRate}% Diversion Rate</strong> · Plastic, Paper, Metal, Glass
            </div>
          </div>

          <div className="editorial-total-card card-coral">
            <div className="total-top">
              <span className="total-badge-label">Residual Landfill Stream</span>
              <ShieldAlert size={18} className="total-card-icon" />
            </div>
            <div className="total-main-number text-coral">
              {Math.round(totals.non_recyclable_liters).toLocaleString()}
              <span className="unit-text">L</span>
            </div>
            <div className="total-footer-info">
              Organic decomposition & non-segregated materials
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Charts */}
      <div className="analytics-grid">
        {/* Waste by Category Bar Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-blue">Category Breakdown</div>
              <h3>Volume by Material Category</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.06)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                    axisLine={{ stroke: 'rgba(15, 23, 42, 0.1)' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      borderRadius: 12,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      color: '#0f172a',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                    formatter={(value) => [`${value.toLocaleString()} Liters`, 'Collected']}
                  />
                  <Bar dataKey="liters" radius={[6, 6, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recyclable vs Non-Recyclable Donut */}
        <div className="card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-emerald">Circular Economy</div>
              <h3>Recyclable vs Residual</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={recyclableData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      borderRadius: 12,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      color: '#0f172a',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                    formatter={(value) => [`${value.toLocaleString()} Liters`, 'Volume']}
                  />
                  <Legend
                    wrapperStyle={{ color: '#64748b', fontSize: 12, paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Hotspot Clusters */}
      <div className="analytics-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-amber">Spatial Hotspots</div>
              <h3>Daily Fill Velocity by Cluster</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={clusterData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 23, 42, 0.06)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                    axisLine={{ stroke: 'rgba(15, 23, 42, 0.1)' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      borderRadius: 12,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                      color: '#0f172a',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  />
                  <Bar dataKey="fillRate" name="Avg Fill Rate (%/day)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="bins" name="Total Bins" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-neutral">Autonomous Directives</div>
              <h3>Cluster Dispatch Strategies</h3>
            </div>
          </div>
          <div className="card-body scrollable-card-body">
            <div className="cluster-list-editorial">
              {patterns?.clusters?.map(cluster => (
                <div key={cluster.cluster_id} className="cluster-item-editorial">
                  <div className="cluster-top-row">
                    <div className="cluster-identity">
                      <span className="cluster-dot-marker"></span>
                      <span className="cluster-title-tag">Cluster {cluster.cluster_id + 1}</span>
                    </div>
                    <span className="cluster-count-pill">{cluster.num_bins} Telemetry Bins</span>
                  </div>
                  <div className="cluster-metric-strip">
                    <div className="cluster-metric-item">
                      <span className="metric-sub">Velocity:</span>
                      <strong>{cluster.avg_daily_fill_rate}% / day</strong>
                    </div>
                    {cluster.days_to_full && (
                      <div className="cluster-metric-item">
                        <span className="metric-sub">Time to 100%:</span>
                        <strong className="text-warning">~{cluster.days_to_full} days</strong>
                      </div>
                    )}
                  </div>
                  <div className="cluster-directive-box">
                    <p>{cluster.recommendation}</p>
                  </div>
                </div>
              ))}
              {(!patterns?.clusters || patterns.clusters.length === 0) && (
                <div className="empty-state">No cluster pattern data currently recorded</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Special Alert Banner: LD College of Engineering (#1 Municipal Producer) */}
      <div className="analytics-special-alert-banner">
        <div className="asab-left">
          <div className="asab-icon-pod">
            <Crown size={22} className="asab-crown-icon" />
          </div>
          <div className="asab-text">
            <div className="asab-header-row">
              <span className="asab-badge">👑 MUNICIPAL MEGA-PRODUCER SPECIAL ALERT</span>
              <span className="asab-zone-pill">West Zone (Navrangpura)</span>
              <span className="asab-capacity-pill">2,400L Mega Dumpster</span>
            </div>
            <h3 className="asab-title">LD College of Engineering is Ahmedabad's #1 Waste Generator</h3>
            <p className="asab-desc">
              Central Big Bin telemetry indicates city-leading generation velocity (~48.5%/day, 1,164L/day). Priority automated compactor scheduling and continuous smart overflow monitoring active.
            </p>
          </div>
        </div>
        <div className="asab-stat-badge">
          <span className="asab-stat-label">Generation Velocity</span>
          <span className="asab-stat-value">Top #1 in AMC</span>
        </div>
      </div>

      {/* Row 3: Top Waste Generation Hotspot Leaderboard */}
      {hotspots.length > 0 && (
        <div className="card hotspot-leaderboard-card">
          <div className="card-header">
            <div className="card-header-titles">
              <div className="card-badge badge-coral">🔥 Highest Waste Generation</div>
              <h3>Top Bins by Daily Fill Velocity</h3>
            </div>
            <span className="pill-counter">Ranked by avg fill rate · Updated live</span>
          </div>
          <div className="card-body">
            <div className="hotspot-table-container">
              <div className="hotspot-table">
                <div className="hotspot-table-header">
                  <span>Rank</span>
                  <span>Bin Name</span>
                  <span>Zone</span>
                  <span>Waste Type</span>
                  <span>Fill Rate</span>
                  <span>Current Fill</span>
                  <span>Heat Tier</span>
                </div>
                {hotspots.map((h, idx) => {
                  const isLdce = idx === 0 || h.is_top_producer || (h.name && h.name.toLowerCase().includes('ld college'));
                  const tierConfig = {
                    critical: { label: 'Critical', color: '#f43f5e', bg: '#fff1f2' },
                    high:     { label: 'High',     color: '#f97316', bg: '#fff7ed' },
                    moderate: { label: 'Moderate', color: '#f59e0b', bg: '#fffbeb' },
                    low:      { label: 'Low',      color: '#10b981', bg: '#ecfdf5' },
                  }[h.heat_tier] || { label: h.heat_tier, color: '#64748b', bg: '#f1f5f9' };
                  return (
                    <div 
                      key={h.bin_id} 
                      className={`hotspot-table-row ${idx < 3 ? 'top-three' : ''} ${isLdce ? 'is-top-producer-row' : ''}`}
                    >
                      <span className="hotspot-rank">
                        {isLdce ? '👑' : idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </span>
                      <div className="hotspot-name-col">
                        <span className="hotspot-bin-name" title={h.name}>{h.name}</span>
                        {isLdce && (
                          <span className="hotspot-ldce-tag">
                            <Crown size={10} /> #1 City Producer (2,400L)
                          </span>
                        )}
                      </div>
                      <span className="hotspot-zone-badge" title={h.zone}>{h.zone}</span>
                      <span className="hotspot-waste-type">{h.waste_type}</span>
                      <span className="hotspot-fill-rate" style={{ color: tierConfig.color, fontWeight: 700 }}>
                        {h.avg_daily_fill_rate}%/day
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
                      <span className="hotspot-tier-badge" style={{ background: tierConfig.bg, color: tierConfig.color }}>
                        {tierConfig.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row 4: AI Recycling Suggestions */}
      <RecyclingSuggestionsPanel />
    </div>
  );
}

export default AnalyticsPage;
