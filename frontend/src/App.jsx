import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, ScanLine, BarChart3, Recycle, Sparkles, Activity, Truck, Bell } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import ClassifyPage from './pages/ClassifyPage';
import FleetTrackingPage from './pages/FleetTrackingPage';
import NotificationsPage from './pages/NotificationsPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <aside className="sidebar">
          <div className="logo-section">
            <div className="brand-badge">
              <span className="brand-badge-text">AMC</span>
              <span className="brand-badge-dot"></span>
            </div>
            <div className="brand-info">
              <div className="brand-title">
                AMC<em>Optimizer</em>
              </div>
              <span className="brand-pill">
                <Sparkles size={11} className="pill-icon" /> Ahmedabad Grid
              </span>
            </div>
          </div>

          <nav className="nav-menu">
            <div className="nav-group-label">Core Platform</div>
            <ul className="nav-links">
              <li>
                <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <LayoutDashboard size={18} className="nav-icon" />
                  <span>Overview & Map</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/fleet" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <Truck size={18} className="nav-icon" />
                  <span>Fleet Tracker</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <Bell size={18} className="nav-icon" />
                  <span>Notifications</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/classify" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <ScanLine size={18} className="nav-icon" />
                  <span>Classify Waste</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  <BarChart3 size={18} className="nav-icon" />
                  <span>Analytics & Trends</span>
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="sidebar-bottom">
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
          </div>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/fleet" element={<FleetTrackingPage />} />
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
