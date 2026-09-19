import { useState, useEffect } from 'react';
import { Recycle, RefreshCw, ChevronDown, ChevronUp, Truck, ArrowUpRight, Layers, ShieldCheck, FileText } from 'lucide-react';
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

function SuggestionCard({ s }) {
  const cfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.low;
  return (
    <div className="suggestion-card" style={{ borderLeft: `3px solid ${cfg.color}` }}>
      <div className="suggestion-top-row">
        <div className="suggestion-icon-wrap" style={{ color: cfg.color, background: cfg.bg }}>
          {TYPE_ICONS[s.type] || <ShieldCheck size={16} />}
        </div>
        <div className="suggestion-meta">
          <span className="suggestion-zone-badge">{s.zone}</span>
          <span className="suggestion-category-tag">{s.category}</span>
          <span className="suggestion-priority-pill" style={{ background: cfg.bg, color: cfg.color }}>
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

      <div className="suggestion-impact-row">
        <ArrowUpRight size={12} />
        <span className="suggestion-impact-text">{s.impact_estimate}</span>
      </div>
    </div>
  );
}

export default function RecyclingSuggestionsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await api.get('/recycling/suggestions');
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch recycling suggestions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, []);

  const suggestions = data?.suggestions || [];
  const summary = data?.summary || {};

  const filtered = filter === 'all'
    ? suggestions
    : suggestions.filter(s => s.priority === filter);

  const highCount = suggestions.filter(s => s.priority === 'high').length;
  const medCount = suggestions.filter(s => s.priority === 'medium').length;

  return (
    <div className="card recycling-panel">
      <div className="card-header">
        <div className="card-header-titles">
          <div className="card-badge badge-emerald">AI Recommendations</div>
          <h3>Recycling &amp; Sustainability Directives</h3>
        </div>
        <div className="card-header-actions">
          {highCount > 0 && (
            <span className="suggestion-urgent-badge">{highCount} Urgent</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(c => !c)}>
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="card-body">
          {loading ? (
            <div className="suggestions-loading">
              <RefreshCw size={20} className="spin" />
              <span>Analyzing waste patterns across all zones...</span>
            </div>
          ) : (
            <>
              {/* Summary bar */}
              {summary.total_bins > 0 && (
                <div className="recycling-summary-bar">
                  <div className="recycling-summary-stat">
                    <span className="rs-value">{summary.total_bins}</span>
                    <span className="rs-label">Bins Analyzed</span>
                  </div>
                  <div className="recycling-summary-stat">
                    <span className="rs-value" style={{ color: '#f43f5e' }}>{summary.critical_bins}</span>
                    <span className="rs-label">Critical Bins</span>
                  </div>
                  <div className="recycling-summary-stat">
                    <span className="rs-value" style={{ color: '#10b981' }}>{summary.recyclability_ratio}%</span>
                    <span className="rs-label">Recyclable Coverage</span>
                  </div>
                  <div className="recycling-summary-stat">
                    <span className="rs-value">{summary.zones_analyzed}</span>
                    <span className="rs-label">Zones Assessed</span>
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div className="suggestion-filter-tabs">
                {['all', 'high', 'medium', 'low'].map(f => (
                  <button
                    key={f}
                    className={`filter-tab ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? `All (${suggestions.length})` :
                     f === 'high' ? `🔴 High (${highCount})` :
                     f === 'medium' ? `🟡 Medium (${medCount})` :
                     `🔵 Info (${suggestions.length - highCount - medCount})`}
                  </button>
                ))}
              </div>

              {/* Suggestions list */}
              <div className="suggestions-list">
                {filtered.length === 0 ? (
                  <div className="suggestions-empty">
                    <ShieldCheck size={28} style={{ color: '#10b981' }} />
                    <p>No suggestions in this category.</p>
                  </div>
                ) : (
                  filtered.map(s => <SuggestionCard key={s.id} s={s} />)
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
