import { Routes, Route } from "react-router-dom";
import WorkbenchLayout from "./components/layout/WorkbenchLayout";
import ChatPanel from "./components/chat/ChatPanel";
import MusicEmbed from "./components/chat/MusicEmbed";
import JournalEmbed from "./components/chat/JournalEmbed";
import ToolsEmbed from "./components/chat/ToolsEmbed";
import PlaceholderPage from "./components/chat/PlaceholderPage";
import PasswordGate from "./components/chat/PasswordGate";
import FitnessEmbed from "./components/chat/FitnessEmbed";

export default function App() {
  return (
    <WorkbenchLayout>
      <Routes>
        <Route path="/" element={<ChatPanel />} />
        <Route path="/music" element={<MusicEmbed />} />
        <Route path="/journal" element={<JournalEmbed />} />
        <Route path="/tools" element={<ToolsEmbed />} />
        <Route path="/cycling" element={<PlaceholderPage title="骑行" icon="🚴" />} />
        <Route path="/fitness" element={<FitnessEmbed />} />
        <Route path="/travel" element={<PasswordGate><PlaceholderPage title="放肆一百次" icon="✈️" /></PasswordGate>} />
      </Routes>
    </WorkbenchLayout>
  );
}
