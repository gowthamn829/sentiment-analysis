import { NavLink } from "react-router-dom";
import {
  Brain,
  FlaskConical,
  ChartNoAxesCombined,
  Files,
} from "lucide-react";

function Sidebar() {
  const links = [
    { path: "/analyze", label: "Analyze", icon: Brain },
    { path: "/workbench", label: "Workbench", icon: FlaskConical },
    {
      path: "/insights",
      label: "Insights",
      icon: ChartNoAxesCombined,
    },
    { path: "/batch", label: "Batch", icon: Files },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <Brain size={23} />
        </div>

        <div>
          <h2>Sentiment Lab</h2>
          <p>Ensemble intelligence</p>
        </div>
      </div>

      <p className="nav-heading">WORKSPACE</p>

      <nav className="sidebar-nav">
        {links.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dataset-status">
        <span className="status-dot" />
        <span className="status-label">Active dataset</span>

        <strong>No dataset trained yet</strong>

        <p>Upload a labeled CSV in Workbench to begin.</p>
      </div>

      <div className="sidebar-footer">
        <span className="online-dot" />
        Local ML workspace
      </div>
    </aside>
  );
}

export default Sidebar;