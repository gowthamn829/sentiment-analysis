import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

const pageTitles = {
  "/analyze": "Analyze",
  "/workbench": "Workbench",
  "/insights": "Insights",
  "/batch": "Batch",
};

function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "Analyze";

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">SENTIMENT ANALYSIS</p>
            <h1>{title}</h1>
          </div>

          <div className="backend-status">
            <span className="status-dot" />
            FastAPI workspace
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;