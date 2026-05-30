import type { ReactNode } from "react";
import { Sparkles, Music, Bike, Dumbbell, Plane } from "lucide-react";
import MiniPlayer from "./MiniPlayer";

const modules = [
  { name: "AI 对话", icon: Sparkles, path: "/", active: true },
  { name: "音乐", icon: Music, path: "http://localhost:5173", active: true, external: true },
  { name: "骑行", icon: Bike, active: false },
  { name: "健身", icon: Dumbbell, active: false },
  { name: "旅游", icon: Plane, active: false },
];

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-bg">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col glass-strong border-r border-border/60 p-3 gap-1 rounded-r-2xl shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-text">工作台</span>
              <p className="text-[10px] text-text-dim">v0.1.0</p>
            </div>
          </div>

          <p className="px-3 text-[10px] uppercase tracking-wider text-text-dim mb-1">模块</p>
          {modules.map((m) => {
            const isActive = m.active;
            return m.external ? (
              <a
                key={m.name}
                href={m.path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-text-dim hover:text-text hover:bg-accent/5 border border-transparent transition-all"
              >
                <m.icon className="w-4 h-4" />
                {m.name}
              </a>
            ) : (
              <div
                key={m.name}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all border ${
                  isActive
                    ? "bg-accent/15 text-accent-dim font-semibold border-accent/20"
                    : "text-text-dim border-transparent opacity-50"
                }`}
              >
                <m.icon className="w-4 h-4" />
                {m.name}
                {!isActive && <span className="text-[10px] ml-auto text-text-dim">即将上线</span>}
              </div>
            );
          })}

          <div className="mt-auto pt-4 border-t border-border/30">
            <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-text-dim">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              workbench v0.1.0 · Online
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {/* Mini Player — top-right floating */}
      <MiniPlayer />
    </div>
  );
}
