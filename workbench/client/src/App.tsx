import { Routes, Route } from "react-router-dom";
import WorkbenchLayout from "./components/layout/WorkbenchLayout";
import ChatPanel from "./components/chat/ChatPanel";

export default function App() {
  return (
    <WorkbenchLayout>
      <Routes>
        <Route path="/" element={<ChatPanel />} />
      </Routes>
    </WorkbenchLayout>
  );
}
