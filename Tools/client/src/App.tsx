import { Routes, Route } from "react-router-dom";
import ToolsLayout from "./components/layout/ToolsLayout";
import ToolsHome from "./components/layout/ToolsHome";
import TimerDashboard from "./components/timer/TimerDashboard";
import ExecutionHistory from "./components/timer/ExecutionHistory";
import JournalHome from "./components/journal/JournalHome";
import JournalLockGate from "./components/journal/JournalLockGate";
import BeadPatternMaker from "./components/beads/BeadPatternMaker";
import PetCenter from "./components/pet/PetCenter";
import YunxiaoTaskCreator from "./components/yunxiao/YunxiaoTaskCreator";

const lockedJournal = (
  <JournalLockGate>
    <JournalHome />
  </JournalLockGate>
);

export default function App() {
  return (
    <Routes>
      {/* Standalone journal — embedded in workbench, no Tools sidebar */}
      <Route path="/embed/journal" element={lockedJournal} />

      {/* Tools wrapped in sidebar layout */}
      <Route
        path="*"
        element={
          <ToolsLayout>
            <Routes>
              <Route path="/" element={<ToolsHome />} />
              <Route path="/timer" element={<TimerDashboard />} />
              <Route path="/timer/history" element={<ExecutionHistory />} />
              <Route path="/journal" element={lockedJournal} />
              <Route path="/beads" element={<BeadPatternMaker />} />
              <Route path="/pet" element={<PetCenter />} />
              <Route path="/yunxiao" element={<YunxiaoTaskCreator />} />
            </Routes>
          </ToolsLayout>
        }
      />
    </Routes>
  );
}
