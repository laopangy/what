import { Navigate, Routes, Route } from "react-router-dom";
import WorkbenchLayout from "./components/layout/WorkbenchLayout";
import ChatPanel from "./components/chat/ChatPanel";
import MusicEmbed from "./components/chat/MusicEmbed";
import JournalEmbed from "./components/chat/JournalEmbed";
import ToolsEmbed from "./components/chat/ToolsEmbed";
import PasswordGate from "./components/chat/PasswordGate";
import FitnessEmbed from "./components/chat/FitnessEmbed";
import OutdoorEmbed from "./components/chat/OutdoorEmbed";

export default function App() {
  return (
    <PasswordGate>
      <WorkbenchLayout>
        <Routes>
          <Route path="/" element={<ChatPanel />} />
          <Route path="/music" element={<MusicEmbed />} />
          <Route path="/journal" element={<JournalEmbed />} />
          <Route path="/tools" element={<ToolsEmbed />} />
          <Route path="/outdoor" element={<OutdoorEmbed />} />
          <Route path="/cycling" element={<Navigate to="/outdoor" replace />} />
          <Route path="/fitness" element={<FitnessEmbed />} />
          <Route path="/travel" element={<Navigate to="/outdoor" replace />} />
        </Routes>
      </WorkbenchLayout>
    </PasswordGate>
  );
}
