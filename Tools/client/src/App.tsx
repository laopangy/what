import { Routes, Route } from "react-router-dom";
import ToolsLayout from "./components/layout/ToolsLayout";
import ToolsHome from "./components/layout/ToolsHome";
import TimerDashboard from "./components/timer/TimerDashboard";
import ExecutionHistory from "./components/timer/ExecutionHistory";
import JournalHome from "./components/journal/JournalHome";

export default function App() {
  return (
    <Routes>
      {/* Standalone journal — embedded in workbench, no Tools sidebar */}
      <Route path="/embed/journal" element={<JournalHome />} />

      {/* Tools wrapped in sidebar layout */}
      <Route
        path="*"
        element={
          <ToolsLayout>
            <Routes>
              <Route path="/" element={<ToolsHome />} />
              <Route path="/timer" element={<TimerDashboard />} />
              <Route path="/timer/history" element={<ExecutionHistory />} />
              <Route path="/journal" element={<JournalHome />} />
            </Routes>
          </ToolsLayout>
        }
      />
    </Routes>
  );
}
