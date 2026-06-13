import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Sparkles, Music, Bike, Dumbbell, Plane } from "lucide-react";

const modules = [
  { name: "AI 对话", icon: Sparkles, path: "/", active: true },
  { name: "音乐", icon: Music, path: "/music", active: true },
  { name: "骑行", icon: Bike, active: false },
  { name: "健身", icon: Dumbbell, active: false },
  { name: "旅游", icon: Plane, active: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium smooth border relative overflow-hidden ${
    isActive
      ? "bg-gradient-to-r from-accent/15 to-purple/10 text-accent-dim border-accent/20 shadow-[0_2px_12px_rgb(99_102_241_/_0.12)]"
      : "text-text-dim border-transparent hover:text-text hover:bg-accent/5 hover:border-accent/10"
  }`;

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-bg">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col glass-strong p-3 gap-0.5 rounded-r-2xl shrink-0 border-r-0 relative">
          {/* subtle right-edge gradient line */}
          <div className="absolute right-0 top-8 bottom-8 w-px bg-gradient-to-b from-transparent via-accent/30 to-transparent" />

          {/* Logo */}
          <div className="flex items-center gap-3 px-3 py-4 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent via-purple to-pink flex items-center justify-center shadow-[0_4px_16px_rgb(99_102_241_/_0.3)] float">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-[15px] text-text tracking-tight">工作台</span>
              <p className="text-[10px] text-text-dim tracking-wide">AI · 音乐 · 生活</p>
            </div>
          </div>

          <p className="px-3.5 text-[10px] uppercase tracking-[0.15em] text-text-dim/60 mb-1 mt-1 font-medium">
            模块
          </p>

          {modules.map((m, i) => {
            if (!m.active) return (
              <div
                key={m.name}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] text-text-dim/40 border border-transparent select-none"
              >
                <m.icon className="w-4 h-4 opacity-40" />
                {m.name}
                <span className="text-[9px] ml-auto text-text-dim/30 uppercase tracking-wider">即将上线</span>
              </div>
            );
            return (
              <NavLink key={m.name} to={m.path!} className={linkClass}>
                <m.icon className="w-4 h-4" />
                {m.name}
                {i === 0 && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgb(99_102_241_/_0.6)]" />
                )}
              </NavLink>
            );
          })}

          {/* Footer */}
          <div className="mt-auto pt-4">
            <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent mb-3" />
            <div className="px-3.5 py-2 flex items-center gap-2 text-[11px] text-text-dim/70">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgb(52_211_153_/_0.5)]" />
              </span>
              在线
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
