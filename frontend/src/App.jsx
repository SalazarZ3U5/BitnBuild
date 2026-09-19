import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import ClassifyPage from './pages/ClassifyPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="sidebar">
          <div className="logo">
            <div className="logo-icon">♻️</div>
            <h1>WasteOptimizer</h1>
            <span className="logo-subtitle">AI-Powered</span>
          </div>
          <ul className="nav-links">
            <li>
              <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">📊</span>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/classify" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">🔍</span>
                Classify Waste
              </NavLink>
            </li>
            <li>
              <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">📈</span>
                Analytics
              </NavLink>
            </li>
          </ul>
          <div className="sidebar-footer">
            <p>BitnBuild 2026</p>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/classify" element={<ClassifyPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
