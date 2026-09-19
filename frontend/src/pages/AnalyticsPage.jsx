import { useState, useEffect } from 'react';
import api from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

function AnalyticsPage() {
  const [patterns, setPatterns] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [patternsRes, totalsRes] = await Promise.all([
          api.get('/analytics/patterns'),
          api.get('/analytics/waste-totals'),
        ]);
        setPatterns(patternsRes.data);
        setTotals(totalsRes.data);
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
      <div className="loading">
        <div className="spinner"></div>
        Loading analytics...
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

  return (
    <div>
      <div className="page-header">
        <h2>Analytics</h2>
        <p>Waste generation patterns, hotspot analysis, and collection insights</p>
      </div>

      {/* Totals Summary */}
      {totals && (
        <div className="totals-grid">
          <div className="total-card">
            <div className="total-value">{Math.round(totals.total_liters).toLocaleString()}L</div>
            <div className="total-label">Total Waste Collected</div>
          </div>
          <div className="total-card">
            <div className="total-value" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {Math.round(totals.recyclable_liters).toLocaleString()}L
            </div>
            <div className="total-label">Recyclable</div>
          </div>
          <div className="total-card">
            <div className="total-value" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {Math.round(totals.non_recyclable_liters).toLocaleString()}L
            </div>
            <div className="total-label">Non-Recyclable</div>
          </div>
        </div>
      )}

      <div className="analytics-grid">
        {/* Waste by Category Bar Chart */}
        <div className="card">
          <div className="card-header">
            <h3>📊 Waste by Category</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1f35',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 8,
                      color: '#f1f5f9',
                    }}
                    formatter={(value) => [`${value.toLocaleString()}L`, 'Volume']}
                  />
                  <Bar dataKey="liters" radius={[6, 6, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recyclable vs Non-Recyclable Pie */}
        <div className="card">
          <div className="card-header">
            <h3>♻️ Recyclable vs Non-Recyclable</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recyclableData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1a1f35',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 8,
                      color: '#f1f5f9',
                    }}
                    formatter={(value) => [`${value.toLocaleString()}L`, 'Volume']}
                  />
                  <Legend
                    wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Hotspot Clusters */}
      <div className="analytics-grid">
        <div className="card">
          <div className="card-header">
            <h3>🔥 Hotspot Clusters</h3>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clusterData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1f35',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 8,
                      color: '#f1f5f9',
                    }}
                  />
                  <Bar dataKey="fillRate" name="Avg Fill Rate (%/day)" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="bins" name="Number of Bins" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>📋 Cluster Details & Recommendations</h3>
          </div>
          <div className="card-body">
            <ul className="cluster-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {patterns?.clusters?.map(cluster => (
                <li key={cluster.cluster_id} className="cluster-item">
                  <div className="cluster-header">
                    <span className="cluster-name">Cluster {cluster.cluster_id + 1}</span>
                    <span className="cluster-badge">{cluster.num_bins} bins</span>
                  </div>
                  <div className="cluster-stats">
                    Fill rate: {cluster.avg_daily_fill_rate}%/day
                    {cluster.days_to_full && ` · Full in ~${cluster.days_to_full} days`}
                  </div>
                  <div className="cluster-recommendation">{cluster.recommendation}</div>
                </li>
              ))}
              {(!patterns?.clusters || patterns.clusters.length === 0) && (
                <li className="empty-state">No cluster data available</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
