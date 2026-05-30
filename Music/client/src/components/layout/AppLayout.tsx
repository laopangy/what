import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import MusicBar from "./MusicBar";
import { usePlaybackState } from "../../hooks/usePlaybackState";

export default function AppLayout({ children }: { children: ReactNode }) {
  usePlaybackState();

  return (
    <div className="h-screen flex flex-col bg-bg">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <MusicBar />
    </div>
  );
}
