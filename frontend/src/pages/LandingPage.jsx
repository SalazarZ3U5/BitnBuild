import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';
import {
  Sparkles,
  LayoutDashboard,
  ScanLine,
  TrendingUp,
  Truck,
  BarChart3,
  Recycle,
  MapPin,
  Activity,
  ArrowRight,
  ChevronRight,
  TreeDeciduous,
  Droplets,
  BatteryCharging,
  Radar,
  Brain,
  Target,
  Layers,
  Play,
} from 'lucide-react';

/* ─── Animated Counter ─────────────────────────────────────────────────── */
function AnimatedCounter({ end, duration = 2000, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = 0;
          const stepTime = Math.max(Math.floor(duration / end), 8);
          let current = start;
          const timer = setInterval(() => {
            current += Math.ceil(end / (duration / stepTime));
            if (current >= end) {
              current = end;
              clearInterval(timer);
            }
            setCount(current);
          }, stepTime);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

/* ─── Feature Card ─────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, iconClass, title, description, tag, delay }) {
  return (
    <div className="landing-feature-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="landing-feature-card-header">
        <div className={`landing-feature-icon ${iconClass}`}>
          <Icon size={22} />
        </div>
        {tag && <span className="landing-feature-tag">{tag}</span>}
      </div>
      <h3 className="landing-feature-title">{title}</h3>
      <p className="landing-feature-desc">{description}</p>
    </div>
  );
}



/* ═════════════════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                           */
/* ═════════════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    {
      icon: MapPin,
      iconClass: 'icon-cobalt',
      title: 'Real-Time GIS Monitoring',
      description: '250 IoT-equipped bins across 5 AMC zones with live fill telemetry, color-coded administrative sectors, and pulsating hotspot overlays.',
      tag: 'Live',
    },
    {
      icon: Brain,
      iconClass: 'icon-violet',
      title: 'Prophet Overflow Forecasting',
      description: 'Meta Prophet time-series regression predicts overflow windows from T+1h to T+72h with dynamic risk heatmaps and proactive dispatch.',
      tag: 'AI',
    },
    {
      icon: Truck,
      iconClass: 'icon-emerald',
      title: 'Multi-Vehicle CVRP Dispatch',
      description: 'Google OR-Tools solves Capacitated Vehicle Routing across 4 AMC depots with A* road-snapped pathfinding and OSRM bridge routing.',
      tag: 'Optimizer',
    },
    {
      icon: ScanLine,
      iconClass: 'icon-coral',
      title: 'Edge CNN Waste Classifier',
      description: 'Embedded 1.1MB LargeNet PyTorch model classifies waste into 6 streams (Plastic, Organic, Paper, Glass, Metal, Residual) with zero cloud latency.',
      tag: 'On-Device',
    },
    {
      icon: Recycle,
      iconClass: 'icon-canary',
      title: 'Circular Recovery Directives',
      description: 'Autonomous recycling policy engine evaluating segregation ratios and recommending diversion strategies mapped to certified AMC facilities.',
      tag: 'Policy',
    },
    {
      icon: BarChart3,
      iconClass: 'icon-cobalt',
      title: 'Macro Spatial Analytics',
      description: 'K-Means cluster analysis, 5-zone radar footprints, hotspot velocity leaderboards, and quantified sustainability impact metrics.',
      tag: 'Intel',
    },
  ];

  return (
    <div className="landing-page">
      {/* ── Floating Nav ──────────────────────────────────────────────── */}
      <nav className="landing-nav" style={{ 
        background: scrollY > 20 ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
        boxShadow: scrollY > 20 ? '0 4px 30px rgba(15, 23, 42, 0.04)' : 'none',
      }}>
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <div className="landing-nav-badge">
              <span>AMC</span>
              <span className="landing-nav-badge-dot"></span>
            </div>
            <div className="landing-nav-brand-text">
              <span className="landing-nav-title">AMC<em>Optimizer</em></span>
              <span className="landing-nav-subtitle">
                <Sparkles size={10} /> Ahmedabad Grid
              </span>
            </div>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#impact">Impact</a>
            <a href="#zones">Zones</a>
          </div>
          <button className="btn btn-primary landing-nav-cta" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={16} />
            Launch Platform
          </button>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-grid-pattern"></div>
          <div className="landing-hero-glow-1"></div>
          <div className="landing-hero-glow-2"></div>
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-badges">
            <span className="landing-hero-badge">
              <Sparkles size={12} /> BitNBuild 2026
            </span>
            <span className="landing-hero-badge landing-hero-badge-live">
              <span className="live-dot-sm"></span> Live Platform
            </span>
          </div>

          <h1 className="landing-hero-title">
            Next-Gen Municipal<br />
            <em>Waste Intelligence</em>
          </h1>

          <p className="landing-hero-subtitle">
            AI-powered waste management platform for Ahmedabad Municipal Corporation — 
            featuring ML overflow prediction, on-device CNN classification, 
            intelligent fleet dispatch, and real-time IoT telemetry.
          </p>

          <div className="landing-hero-actions">
            <button className="btn landing-hero-btn-primary" onClick={() => navigate('/dashboard')}>
              <Play size={18} />
              Enter Control Center
              <ArrowRight size={16} />
            </button>
            <a className="btn landing-hero-btn-secondary" href="#features">
              Explore Features
              <ChevronRight size={16} />
            </a>
          </div>

          <div className="landing-hero-metrics">
            <div className="landing-hero-metric">
              <span className="landing-hero-metric-value">
                <AnimatedCounter end={250} duration={1500} />
              </span>
              <span className="landing-hero-metric-label">Smart Bins</span>
            </div>
            <div className="landing-hero-metric-divider"></div>
            <div className="landing-hero-metric">
              <span className="landing-hero-metric-value">
                <AnimatedCounter end={5} duration={1200} />
              </span>
              <span className="landing-hero-metric-label">AMC Zones</span>
            </div>
            <div className="landing-hero-metric-divider"></div>
            <div className="landing-hero-metric">
              <span className="landing-hero-metric-value">
                <AnimatedCounter end={4} duration={1000} />
              </span>
              <span className="landing-hero-metric-label">Fleet Trucks</span>
            </div>
            <div className="landing-hero-metric-divider"></div>
            <div className="landing-hero-metric">
              <span className="landing-hero-metric-value">
                <AnimatedCounter end={6} duration={1000} />
              </span>
              <span className="landing-hero-metric-label">AI Models</span>
            </div>
          </div>
        </div>

        <div className="landing-hero-scroll-hint">
          <div className="landing-scroll-mouse">
            <div className="landing-scroll-dot"></div>
          </div>
          <span>Scroll to explore</span>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-badge">
              <Layers size={13} /> Core Capabilities
            </span>
            <h2 className="landing-section-title">
              Six Pillars of <em>Intelligent</em> Waste Management
            </h2>
            <p className="landing-section-subtitle">
              From edge AI classification to city-wide route optimization — every module 
              is purpose-built for Ahmedabad's municipal infrastructure.
            </p>
          </div>

          <div className="landing-features-grid">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>



      {/* ── Impact Section ────────────────────────────────────────────── */}
      <section className="landing-section" id="impact">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-badge">
              <TreeDeciduous size={13} /> Environmental Impact
            </span>
            <h2 className="landing-section-title">
              Measurable <em>Sustainability</em> Outcomes
            </h2>
            <p className="landing-section-subtitle">
              Every optimized route and diverted waste stream translates into tangible environmental savings.
            </p>
          </div>

          <div className="landing-impact-grid">
            <div className="landing-impact-card landing-impact-trees">
              <div className="landing-impact-icon">
                <TreeDeciduous size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={64} duration={2000} />
              </span>
              <span className="landing-impact-unit">Mature Trees</span>
              <span className="landing-impact-desc">Conserved annually through paper recycling diversion</span>
            </div>

            <div className="landing-impact-card landing-impact-co2">
              <div className="landing-impact-icon">
                <Droplets size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={81} duration={2000} suffix=" tons" />
              </span>
              <span className="landing-impact-unit">CO₂e Mitigated</span>
              <span className="landing-impact-desc">Greenhouse gas reduction from optimized collection routes</span>
            </div>

            <div className="landing-impact-card landing-impact-energy">
              <div className="landing-impact-icon">
                <BatteryCharging size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={2781} duration={2500} suffix=" kWh" />
              </span>
              <span className="landing-impact-unit">Clean Power Generated</span>
              <span className="landing-impact-desc">Biomethanation energy from organic waste diversion</span>
            </div>

            <div className="landing-impact-card landing-impact-landfill">
              <div className="landing-impact-icon">
                <Target size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={149} duration={2000} suffix=" m³" />
              </span>
              <span className="landing-impact-unit">Landfill Airspace</span>
              <span className="landing-impact-desc">Landfill volume spared through material recovery</span>
            </div>
          </div>

          <div className="landing-diversion-bar">
            <div className="landing-diversion-header">
              <span>Recycling Diversion Rate</span>
              <span className="landing-diversion-pct">44.2%</span>
            </div>
            <div className="landing-diversion-track">
              <div className="landing-diversion-fill" style={{ width: '44.2%' }}></div>
            </div>
            <div className="landing-diversion-labels">
              <span>Organic · Paper · Plastic · Metal · Glass</span>
              <span>149,145 L Total Volume (30-day)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Zones Coverage Section ────────────────────────────────────── */}
      <section className="landing-section landing-section-zones" id="zones">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <span className="landing-section-badge">
              <Radar size={13} /> Coverage
            </span>
            <h2 className="landing-section-title">
              Citywide <em>Deployment</em> Map
            </h2>
            <p className="landing-section-subtitle">
              250 authentic landmark-mapped bins across Ahmedabad's 5 administrative zones.
            </p>
          </div>

          <div className="landing-zones-grid">
            {[
              { name: 'West Zone', area: 'Navrangpura', bins: 50, color: '#2563eb', highlights: 'University Hub · Law Garden · C.G. Road · Ashram Rd' },
              { name: 'North-West Zone', area: 'Bodakdev / Vastrapur', bins: 50, color: '#8b5cf6', highlights: 'Science City · IIM Ahmedabad · Alpha One · Sola' },
              { name: 'South-West Zone', area: 'Satellite / Prahlad Nagar', bins: 50, color: '#f59e0b', highlights: 'Prahlad Nagar Garden · Sarkhej Roza · Jodhpur Gam' },
              { name: 'Central Zone', area: 'Old City / Riverfront', bins: 50, color: '#f43f5e', highlights: 'Sabarmati Riverfront · Bhadra Fort · Manek Chowk' },
              { name: 'East Zone', area: 'Bapunagar / Kankaria', bins: 50, color: '#10b981', highlights: 'Kankaria Lake · Maninagar Station · Gita Mandir · Nikol' },
            ].map((zone, i) => (
              <div className="landing-zone-card" key={i} style={{ borderTopColor: zone.color }}>
                <div className="landing-zone-head">
                  <span className="landing-zone-dot" style={{ background: zone.color }}></span>
                  <h4 className="landing-zone-name">{zone.name}</h4>
                </div>
                <span className="landing-zone-area">{zone.area}</span>
                <span className="landing-zone-bins">{zone.bins} Smart Bins</span>
                <span className="landing-zone-highlights">{zone.highlights}</span>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ── CTA Section ───────────────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="landing-cta-inner">
          <div className="landing-cta-glow"></div>
          <span className="landing-cta-badge">
            <Activity size={13} /> System Active
          </span>
          <h2 className="landing-cta-title">
            Ready to Optimize <em>Ahmedabad's</em> Waste?
          </h2>
          <p className="landing-cta-subtitle">
            Launch the full control center with live IoT telemetry, AI forecasting, 
            intelligent fleet dispatch, and real-time analytics.
          </p>
          <button className="btn landing-cta-btn" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={18} />
            Launch Control Center
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-nav-badge landing-footer-badge">
              <span>AMC</span>
              <span className="landing-nav-badge-dot"></span>
            </div>
            <span className="landing-footer-copy">
              AMC<em>Optimizer</em> · Municipal Waste Intelligence Platform · BitNBuild 2026
            </span>
          </div>
          <div className="landing-footer-links">
            <span>FastAPI · React · PyTorch · OR-Tools · PostGIS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
