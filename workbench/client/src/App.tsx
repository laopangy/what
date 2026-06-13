import { Routes, Route } from "react-router-dom";
import WorkbenchLayout from "./components/layout/WorkbenchLayout";
import ChatPanel from "./components/chat/ChatPanel";
import MusicEmbed from "./components/chat/MusicEmbed";

export default function App() {
  return (
    <WorkbenchLayout>
      <Routes>
        <Route path="/" element={<ChatPanel />} />
        <Route path="/music" element={<MusicEmbed />} />
      </Routes>
    </WorkbenchLayout>
  );
}
