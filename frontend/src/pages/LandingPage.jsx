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
  Zap,
  Shield,
  Wifi,
  Cpu,
  Database,
  GitBranch,
  Box,
  Heart,
  Code2,
  Monitor,
  Image,
  Eye,
} from 'lucide-react';

/* ─── Particle Background Canvas ──────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse = useRef({ x: -1000, y: -1000 });
  const animId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const PARTICLE_COUNT = 80;
    const CONNECTION_DIST = 140;
    const MOUSE_DIST = 200;

    // Initialize particles
    particles.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    const handleMouse = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouse);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const pts = particles.current;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Mouse repulsion
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_DIST) {
          const force = (MOUSE_DIST - dist) / MOUSE_DIST * 0.02;
          p.vx += dx * force;
          p.vy += dy * force;
        }

        // Dampen velocity
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${p.alpha * 0.6})`;
        ctx.fill();

        // Draw connections
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const cdx = p.x - q.x;
          const cdy = p.y - q.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist < CONNECTION_DIST) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.08 * (1 - cdist / CONNECTION_DIST)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouse);
      if (animId.current) cancelAnimationFrame(animId.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-particles-canvas" />;
}

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
          const stepTime = Math.max(Math.floor(duration / end), 8);
          let current = 0;
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

/* ─── Feature Card (Glassmorphic) ──────────────────────────────────────── */
function FeatureCard({ icon: Icon, iconClass, title, description, tag, delay }) {
  return (
    <div className="landing-feature-card scroll-reveal" style={{ transitionDelay: `${delay}ms` }}>
      <div className="landing-feature-card-header">
        <div className={`landing-feature-icon ${iconClass}`}>
          <Icon size={24} />
        </div>
        {tag && <span className="landing-feature-tag">{tag}</span>}
      </div>
      <h3 className="landing-feature-title">{title}</h3>
      <p className="landing-feature-desc">{description}</p>
    </div>
  );
}

/* ─── Scroll Reveal Hook ───────────────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll('.scroll-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ─── Screenshot Showcase ──────────────────────────────────────────────── */
function ScreenshotShowcase() {
  const [activeTab, setActiveTab] = useState(0);

  const showcaseItems = [
    {
      label: 'Dashboard & Map',
      icon: LayoutDashboard,
      images: [
        { src: '/screenshots/dashboard_overview.png', caption: 'Live GIS dashboard with 250 IoT bins, fill-level telemetry, and zone overlays' },
        { src: '/screenshots/area_color_sectors.png', caption: 'Color-coded administrative sectors across 5 AMC zones' },
      ],
    },
    {
      label: 'Fleet Dispatch',
      icon: Truck,
      images: [
        { src: '/screenshots/fleet_tracking.png', caption: 'Multi-vehicle CVRP dispatch with A* road-snapped routing and live truck tracking' },
      ],
    },
    {
      label: 'AI Forecast',
      icon: TrendingUp,
      images: [
        { src: '/screenshots/waste_forecasting.png', caption: 'Prophet time-series overflow prediction with T+1h to T+72h risk heatmaps' },
      ],
    },
    {
      label: 'Waste Classifier',
      icon: ScanLine,
      images: [
        { src: '/screenshots/ai_classifier.png', caption: 'Edge CNN classifying waste into 6 streams with zero cloud latency' },
      ],
    },
    {
      label: 'Analytics',
      icon: BarChart3,
      images: [
        { src: '/screenshots/analytics_clusters_radar.png', caption: 'K-Means cluster analysis and 5-zone radar footprints' },
        { src: '/screenshots/analytics_hotspots.png', caption: 'Hotspot velocity leaderboards and spatial heatmap analysis' },
        { src: '/screenshots/analytics_volumetrics.png', caption: 'Volumetric waste tracking and trend analysis across zones' },
        { src: '/screenshots/analytics_sustainability.png', caption: 'Sustainability impact metrics and environmental scoring' },
      ],
    },
    {
      label: 'Recycling',
      icon: Recycle,
      images: [
        { src: '/screenshots/recycling_directive_map.png', caption: 'Recycling facility mapping with diversion strategy overlays' },
        { src: '/screenshots/recycling_methods_protocols.png', caption: 'Material recovery protocols and processing guidelines' },
      ],
    },
  ];

  const activeItem = showcaseItems[activeTab];

  return (
    <section className="landing-section landing-showcase-section" id="showcase">
      <div className="landing-section-inner">
        <div className="landing-section-header scroll-reveal">
          <span className="landing-section-badge">
            <Monitor size={13} /> Platform Preview
          </span>
          <h2 className="landing-section-title">
            See It in <em>Action</em>
          </h2>
          <p className="landing-section-subtitle">
            Explore every module of the platform — from live GIS monitoring to AI-powered waste classification.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="showcase-tabs scroll-reveal">
          {showcaseItems.map((item, i) => {
            const TabIcon = item.icon;
            return (
              <button
                key={i}
                className={`showcase-tab ${activeTab === i ? 'active' : ''}`}
                onClick={() => setActiveTab(i)}
              >
                <TabIcon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Image Display */}
        <div className="showcase-display scroll-reveal">
          <div className="showcase-images" key={activeTab}>
            {activeItem.images.map((img, i) => (
              <div className="showcase-image-card" key={i}>
                <div className="showcase-image-wrapper">
                  <img
                    src={img.src}
                    alt={img.caption}
                    loading="lazy"
                  />
                </div>
                <p className="showcase-image-caption">
                  <Eye size={13} />
                  {img.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
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

  useScrollReveal();

  const features = [
    {
      icon: MapPin,
      iconClass: 'icon-cobalt',
      title: 'Real-Time GIS Monitoring',
      description: '250 IoT-equipped bins across 5 AMC zones with live fill telemetry, color-coded administrative sectors, and pulsating hotspot overlays for instant situational awareness.',
      tag: 'Live',
    },
    {
      icon: Brain,
      iconClass: 'icon-violet',
      title: 'Prophet Overflow Forecasting',
      description: 'Meta Prophet time-series regression predicts overflow windows from T+1h to T+72h with dynamic risk heatmaps and proactive dispatch triggers.',
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
      description: 'Embedded 1.1MB LargeNet PyTorch model classifies waste into 6 streams — Plastic, Organic, Paper, Glass, Metal, Residual — with zero cloud latency.',
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
      iconClass: 'icon-cyan',
      title: 'Macro Spatial Analytics',
      description: 'K-Means cluster analysis, 5-zone radar footprints, hotspot velocity leaderboards, and quantified sustainability impact metrics.',
      tag: 'Intel',
    },
    {
      icon: Wifi,
      iconClass: 'icon-cobalt',
      title: 'Live WebSocket Telemetry',
      description: 'Real-time IoT simulation engine with automated playback, +1h manual ticks, baseline resets, and live anomaly injection for stress testing.',
      tag: 'Real-Time',
    },
    {
      icon: Shield,
      iconClass: 'icon-emerald',
      title: 'Anomaly Detection Engine',
      description: 'Night market crowd surges, structural vandalism tilt, and thermal fire hazards are detected instantly with automated alert escalation.',
      tag: 'Safety',
    },
    {
      icon: Zap,
      iconClass: 'icon-canary',
      title: 'Municipal Peak Hotspot Engine',
      description: 'Dedicated Mega Dumpster telemetry (2,400L) tracking peak generation velocity at ~48.5%/day with real-time high-priority compactor dispatch alerts.',
      tag: 'Critical',
    },
  ];

  const techStack = [
    { name: 'FastAPI', role: 'Backend API', color: '#009688' },
    { name: 'React 18', role: 'Frontend UI', color: '#61dafb' },
    { name: 'PyTorch', role: 'ML Engine', color: '#ee4c2c' },
    { name: 'OR-Tools', role: 'Route Optimizer', color: '#4285f4' },
    { name: 'PostGIS', role: 'Spatial DB', color: '#4169e1' },
    { name: 'Prophet', role: 'Forecasting', color: '#8b5cf6' },
    { name: 'Docker', role: 'Containers', color: '#2496ed' },
    { name: 'WebSocket', role: 'Live Stream', color: '#10b981' },
    { name: 'OSRM', role: 'Road Routing', color: '#f59e0b' },
    { name: 'Leaflet', role: 'Map Engine', color: '#199900' },
  ];

  return (
    <div className="landing-page">
      {/* ── Animated Particle Background ───────────────────────────────── */}
      <ParticleCanvas />

      {/* ── Gradient Mesh Blobs ────────────────────────────────────────── */}
      <div className="landing-gradient-mesh">
        <div className="landing-mesh-orb"></div>
        <div className="landing-mesh-orb"></div>
        <div className="landing-mesh-orb"></div>
        <div className="landing-mesh-orb"></div>
      </div>

      {/* ── Floating Pill Nav ──────────────────────────────────────────── */}
      <nav className={`landing-nav ${scrollY > 30 ? 'scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <div className="landing-nav-brand">
            <div className="landing-nav-badge">
              <span>AMC</span>
              <span className="landing-nav-badge-dot"></span>
            </div>
            <div className="landing-nav-brand-text">
              <span className="landing-nav-title">AMC<em>Optimizer</em></span>
              <span className="landing-nav-subtitle">
                <Sparkles size={9} /> Ahmedabad Grid
              </span>
            </div>
          </div>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#showcase">Screenshots</a>
            <a href="#impact">Impact</a>
            <a href="#tech">Tech</a>
          </div>
          <button className="btn btn-primary landing-nav-cta" onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={14} />
            Launch Platform
          </button>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="landing-hero">
        {/* Orbital rings */}
        <div className="landing-hero-orbital">
          <div className="landing-orbital-ring">
            <div className="landing-orbital-dot"></div>
          </div>
          <div className="landing-orbital-ring">
            <div className="landing-orbital-dot"></div>
          </div>
          <div className="landing-orbital-ring">
            <div className="landing-orbital-dot"></div>
          </div>
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
            intelligent fleet dispatch, and real-time IoT telemetry across 250 smart bins.
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

      {/* ── Features Section ───────────────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header scroll-reveal">
            <span className="landing-section-badge">
              <Layers size={13} /> Core Capabilities
            </span>
            <h2 className="landing-section-title">
              Nine Pillars of <em>Intelligent</em> Waste Management
            </h2>
            <p className="landing-section-subtitle">
              From edge AI classification to city-wide route optimization — every module
              is purpose-built for Ahmedabad's municipal infrastructure.
            </p>
          </div>

          <div className="landing-features-grid">
            {features.map((f, i) => (
              <FeatureCard key={i} {...f} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Screenshot Showcase ─────────────────────────────────────────── */}
      <ScreenshotShowcase />

      {/* ── How It Works — Pipeline ────────────────────────────────────── */}
      <section className="landing-pipeline-section" id="how-it-works">
        <div className="landing-section-inner">
          <div className="landing-section-header scroll-reveal">
            <span className="landing-section-badge">
              <GitBranch size={13} /> Architecture
            </span>
            <h2 className="landing-section-title">
              How <em>AMCOptimizer</em> Works
            </h2>
            <p className="landing-section-subtitle">
              An end-to-end intelligent pipeline from IoT sensors to optimized fleet dispatch.
            </p>
          </div>

          <div className="landing-pipeline-grid scroll-reveal">
            <div className="landing-pipeline-connector"></div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-number">1</div>
              <h4 className="landing-pipeline-title">Sense</h4>
              <p className="landing-pipeline-desc">
                250 IoT bins stream live fill-level telemetry via WebSocket to the control center every 30 seconds.
              </p>
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-number">2</div>
              <h4 className="landing-pipeline-title">Predict</h4>
              <p className="landing-pipeline-desc">
                Prophet ML models forecast overflow risk windows. CNN classifies waste composition at the edge.
              </p>
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-number">3</div>
              <h4 className="landing-pipeline-title">Optimize</h4>
              <p className="landing-pipeline-desc">
                OR-Tools CVRP solver computes optimal multi-vehicle routes with A* road-snapped pathfinding.
              </p>
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-number">4</div>
              <h4 className="landing-pipeline-title">Dispatch</h4>
              <p className="landing-pipeline-desc">
                4 AMC trucks dispatched simultaneously from regional depots with live progress tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Impact Section ─────────────────────────────────────────────── */}
      <section className="landing-section" id="impact">
        <div className="landing-section-inner">
          <div className="landing-section-header scroll-reveal">
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
            <div className="landing-impact-card landing-impact-trees scroll-reveal" style={{ transitionDelay: '0ms' }}>
              <div className="landing-impact-icon">
                <TreeDeciduous size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={64} duration={2000} />
              </span>
              <span className="landing-impact-unit">Mature Trees</span>
              <span className="landing-impact-desc">Conserved annually through paper recycling diversion</span>
            </div>

            <div className="landing-impact-card landing-impact-co2 scroll-reveal" style={{ transitionDelay: '80ms' }}>
              <div className="landing-impact-icon">
                <Droplets size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={81} duration={2000} suffix=" tons" />
              </span>
              <span className="landing-impact-unit">CO₂e Mitigated</span>
              <span className="landing-impact-desc">Greenhouse gas reduction from optimized collection routes</span>
            </div>

            <div className="landing-impact-card landing-impact-energy scroll-reveal" style={{ transitionDelay: '160ms' }}>
              <div className="landing-impact-icon">
                <BatteryCharging size={28} />
              </div>
              <span className="landing-impact-value">
                <AnimatedCounter end={2781} duration={2500} suffix=" kWh" />
              </span>
              <span className="landing-impact-unit">Clean Power Generated</span>
              <span className="landing-impact-desc">Biomethanation energy from organic waste diversion</span>
            </div>

            <div className="landing-impact-card landing-impact-landfill scroll-reveal" style={{ transitionDelay: '240ms' }}>
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

          <div className="landing-diversion-bar scroll-reveal">
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

      {/* ── Tech Stack Section ─────────────────────────────────────────── */}
      <section className="landing-section" id="tech">
        <div className="landing-section-inner">
          <div className="landing-section-header scroll-reveal">
            <span className="landing-section-badge">
              <Cpu size={13} /> Technology
            </span>
            <h2 className="landing-section-title">
              Built with <em>Production-Grade</em> Tech
            </h2>
            <p className="landing-section-subtitle">
              A full-stack architecture combining cutting-edge ML, spatial computing, and real-time systems.
            </p>
          </div>

          <div className="landing-tech-grid scroll-reveal">
            {techStack.map((tech, i) => (
              <div className="landing-tech-chip" key={i}>
                <span className="landing-tech-chip-dot" style={{ background: tech.color, boxShadow: `0 0 8px ${tech.color}40` }}></span>
                <span className="landing-tech-chip-name">{tech.name}</span>
                <span className="landing-tech-chip-role">{tech.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Zones Coverage Section ─────────────────────────────────────── */}
      <section className="landing-section landing-section-zones" id="zones">
        <div className="landing-section-inner">
          <div className="landing-section-header scroll-reveal">
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
              { name: 'West Zone', area: 'Navrangpura', bins: 50, color: '#818cf8', highlights: 'University Hub · Law Garden · C.G. Road · Ashram Rd' },
              { name: 'North-West Zone', area: 'Bodakdev / Vastrapur', bins: 50, color: '#a78bfa', highlights: 'Science City · IIM Ahmedabad · Alpha One · Sola' },
              { name: 'South-West Zone', area: 'Satellite / Prahlad Nagar', bins: 50, color: '#fbbf24', highlights: 'Prahlad Nagar Garden · Sarkhej Roza · Jodhpur Gam' },
              { name: 'Central Zone', area: 'Old City / Riverfront', bins: 50, color: '#fb7185', highlights: 'Sabarmati Riverfront · Bhadra Fort · Manek Chowk' },
              { name: 'East Zone', area: 'Bapunagar / Kankaria', bins: 50, color: '#6ee7b7', highlights: 'Kankaria Lake · Maninagar Station · Gita Mandir · Nikol' },
            ].map((zone, i) => (
              <div className="landing-zone-card scroll-reveal" key={i} style={{ borderTopColor: zone.color, transitionDelay: `${i * 60}ms` }}>
                <div className="landing-zone-head">
                  <span className="landing-zone-dot" style={{ background: zone.color, color: zone.color }}></span>
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

      {/* ── CTA Section ────────────────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="landing-cta-glow"></div>
        <div className="landing-cta-inner scroll-reveal">
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

      {/* ── Footer — Made by Team ResTart ──────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <div className="landing-footer-brand-row">
                <div className="landing-footer-badge">AMC</div>
                <span className="landing-footer-brand-name">AMC<em>Optimizer</em></span>
              </div>
              <span className="landing-footer-tagline">
                AI-powered municipal waste intelligence platform for Ahmedabad's smart city ecosystem.
              </span>
            </div>

            <div className="landing-footer-links-section">
              <div className="landing-footer-col">
                <h5>Platform</h5>
                <ul>
                  <li>Overview & Map</li>
                  <li>Fleet Tracker</li>
                  <li>AI Forecast</li>
                  <li>Classify Waste</li>
                </ul>
              </div>
              <div className="landing-footer-col">
                <h5>Analytics</h5>
                <ul>
                  <li>Recycling Directives</li>
                  <li>Spatial Analytics</li>
                  <li>Notifications</li>
                  <li>Impact Metrics</li>
                </ul>
              </div>
              <div className="landing-footer-col">
                <h5>Technology</h5>
                <ul>
                  <li>FastAPI · React</li>
                  <li>PyTorch · OR-Tools</li>
                  <li>PostGIS · Docker</li>
                  <li>WebSocket · OSRM</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span className="landing-footer-copy">
              © 2026 AMCOptimizer · Municipal Waste Intelligence Platform
            </span>
            <div className="landing-footer-team">
              <span className="landing-footer-team-badge">
                <Heart size={12} />
                Made by Team ResTart
              </span>
              <span className="landing-footer-hackathon">
                for Bit 'N Build 2026
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
