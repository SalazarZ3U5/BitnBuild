import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ScanLine, 
  BarChart3, 
  Recycle, 
  Sparkles, 
  Activity, 
  Truck, 
  Bell, 
  TrendingUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import ClassifyPage from './pages/ClassifyPage';
import FleetTrackingPage from './pages/FleetTrackingPage';
import NotificationsPage from './pages/NotificationsPage';
import ForecastPage from './pages/ForecastPage';
import './App.css';

function App() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('amc_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('amc_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <Router>
      <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
          <div className="logo-section">
            <div className="brand-badge" title="Ahmedabad Municipal Corporation">
              <span className="brand-badge-text">AMC</span>
              <span className="brand-badge-dot"></span>
            </div>
            {!collapsed && (
              <div className="brand-info">
                <div className="brand-title">
                  AMC<em>Optimizer</em>
                </div>
                <span className="brand-pill">
                  <Sparkles size={11} className="pill-icon" /> Ahmedabad Grid
                </span>
              </div>
            )}
            <button 
              className="sidebar-collapse-btn" 
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          <nav className="nav-menu">
            {!collapsed && <div className="nav-group-label">Core Platform</div>}
            <ul className="nav-links">
              <li>
                <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Overview & Map">
                  <LayoutDashboard size={19} className="nav-icon" />
                  {!collapsed && <span>Overview & Map</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/fleet" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Fleet Tracker">
                  <Truck size={19} className="nav-icon" />
                  {!collapsed && <span>Fleet Tracker</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/forecast" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="AI Forecast">
                  <TrendingUp size={19} className="nav-icon" />
                  {!collapsed && <span>AI Forecast</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Notifications">
                  <Bell size={19} className="nav-icon" />
                  {!collapsed && <span>Notifications</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/classify" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Classify Waste">
                  <ScanLine size={19} className="nav-icon" />
                  {!collapsed && <span>Classify Waste</span>}
                </NavLink>
              </li>
              <li>
                <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} title="Analytics & Trends">
                  <BarChart3 size={19} className="nav-icon" />
                  {!collapsed && <span>Analytics & Trends</span>}
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="sidebar-bottom">
            {collapsed ? (
              <div className="system-status-mini" title="FastAPI & OR-Tools Active · Neural & CVRP Online">
                <span className="status-ping"></span>
                <span className="status-core"></span>
              </div>
            ) : (
              <>
                <div className="system-status-card">
                  <div className="status-indicator">
                    <span className="status-ping"></span>
                    <span className="status-core"></span>
                  </div>
                  <div className="status-details">
                    <span className="status-title">FastAPI · OR-Tools</span>
                    <span className="status-desc">Neural & CVRP Active</span>
                  </div>
                </div>
                <div className="sidebar-meta">
                  <span>AMC · Ahmedabad Smart City</span>
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<FleetTrackingPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/classify" element={<ClassifyPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
