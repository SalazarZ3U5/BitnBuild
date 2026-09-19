import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ScanLine
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

function SuggestionCard({ s }) {
  const cfg = PRIORITY_CONFIG[s.priority] || PRIORITY_CONFIG.low;
  return (
    <div className="suggestion-card" style={{ borderLeft: `4px solid ${cfg.color}` }}>
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
        <ArrowUpRight size={14} style={{ color: '#10b981' }} />
        <span className="suggestion-impact-text">{s.impact_estimate}</span>
      </div>
    </div>
  );
}

export default function RecyclingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/recycling/suggestions');
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch recycling suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

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
            Autonomous material segregation intelligence, dual-stream bin allocation, and automated MRF diversion policies across all 40 AMC municipal bins.
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
            onClick={fetchSuggestions}
            disabled={loading}
            title="Refresh AI Directives"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh Directives</span>
          </button>
        </div>
      </div>

      {/* ── Top KPI Cards Grid ────────────────────────────────────────────── */}
      <div className="forecast-kpis-grid">
        <div className="stat-card stat-total">
          <div className="stat-top">
            <span className="stat-tag">Monitored Bins</span>
            <div className="stat-icon-wrapper"><Layers size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{summary.total_bins || 40}</div>
            <div className="stat-label">Bins Across 5 Zones</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">Ahmedabad Municipal Grid</span>
          </div>
        </div>

        <div className="stat-card stat-critical">
          <div className="stat-top">
            <span className="stat-tag tag-urgent">Critical Bins</span>
            <div className="stat-icon-wrapper icon-critical"><AlertTriangle size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value text-critical">{summary.critical_bins ?? '--'}</div>
            <div className="stat-label">Require Urgent Servicing</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend negative">Threshold Breach &gt;80%</span>
          </div>
        </div>

        <div className="stat-card stat-fill">
          <div className="stat-top">
            <span className="stat-tag">Recyclable Coverage</span>
            <div className="stat-icon-wrapper icon-fill"><Recycle size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value" style={{ color: '#10b981' }}>{summary.recyclability_ratio ?? 45}%</div>
            <div className="stat-label">Diversion Stream Share</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">Plastic, Paper, Metal &amp; Glass</span>
          </div>
        </div>

        <div className="stat-card stat-routes">
          <div className="stat-top">
            <span className="stat-tag tag-dispatch">AI Directives</span>
            <div className="stat-icon-wrapper icon-routes"><Sparkles size={18} /></div>
          </div>
          <div className="stat-body">
            <div className="stat-value">{suggestions.length}</div>
            <div className="stat-label">Actionable Directives Active</div>
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">{highCount > 0 ? `${highCount} Urgent Directives` : 'All Streams Optimized'}</span>
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
              {suggestions.length} Total Directives
            </span>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="suggestions-loading">
              <RefreshCw size={22} className="spin" style={{ color: '#10b981' }} />
              <span>Analyzing real-time waste composition and segregation telemetry...</span>
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
                  filtered.map(s => <SuggestionCard key={s.id} s={s} />)
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Municipal Diversion Guidelines Strip ───────────────────────────── */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div className="card-header-titles">
            <div className="card-badge badge-blue">AMC Municipal Policy</div>
            <h3>Material Recovery Facility (MRF) Diversion Standards</h3>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.2rem' }}>🧴</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--ink-primary)' }}>Dry Plastics (PET/HDPE)</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: '1.5', margin: 0 }}>
              Route directly to Vastrapur / SG Highway compactor lines. Diverts ~35% of commercial corridor volume.
            </p>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.2rem' }}>🥗</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--ink-primary)' }}>Organic Wet Waste</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: '1.5', margin: 0 }}>
              Dedicated transfer from Manek Chowk &amp; Law Garden to decentralized biomethanation &amp; composting plants.
            </p>
          </div>
          <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '1.2rem' }}>📄</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--ink-primary)' }}>Paper &amp; Cardboard</strong>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: '1.5', margin: 0 }}>
              Baling protocol for educational &amp; corporate clusters (Gujarat Univ, LDCE, Corporate Road).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
