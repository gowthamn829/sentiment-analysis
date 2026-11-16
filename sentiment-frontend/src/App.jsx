
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Analyze from "./pages/Analyze";
import Workbench from "./pages/Workbench";
import Insights from "./pages/Insights";
import Batch from "./pages/Batch";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/analyze" replace />} />
        <Route path="analyze" element={<Analyze />} />
        <Route path="workbench" element={<Workbench />} />
        <Route path="insights" element={<Insights />} />
        <Route path="batch" element={<Batch />} />
      </Route>
    </Routes>
  );
}

export default App;
