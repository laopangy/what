import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Sparkles, Music, BookOpen, Wrench, Bike, Dumbbell, Plane } from "lucide-react";
import WeatherBar from "./WeatherBar";
import WindowTitleBar from "./WindowTitleBar";

const modules = [
  { name: "AI 对话", icon: Sparkles, path: "/" },
  { name: "音乐", icon: Music, path: "/music" },
  { name: "随手记", icon: BookOpen, path: "/journal" },
  { name: "骑行", icon: Bike, path: "/cycling" },
  { name: "肌肉大", icon: Dumbbell, path: "/fitness" },
  { name: "放肆一百次", icon: Plane, path: "/travel" },
  { name: "工具", icon: Wrench, path: "/tools" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium smooth border relative overflow-hidden ${
    isActive
      ? "bg-accent/[0.11] text-accent-dim border-accent/25 shadow-[inset_2px_0_0_#d99a16]"
      : "text-text-dim border-transparent hover:text-text hover:bg-white/[0.035] hover:border-border/60"
  }`;

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-bg">
      <WindowTitleBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex flex-col bg-surface/95 p-2.5 gap-0.5 shrink-0 border-r border-border/70 relative shadow-[12px_0_30px_rgb(0_0_0_/_0.18)]">
          {/* subtle right-edge gradient line */}
          <div className="absolute right-0 top-0 h-24 w-px bg-gradient-to-b from-accent/55 to-transparent" />

          {/* Logo */}
          <div className="flex items-center gap-2.5 px-2.5 py-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-[0_5px_16px_rgb(217_154_22_/_0.18)]">
              <Sparkles className="w-4 h-4 text-[#17130a]" />
            </div>
            <div>
              <span className="font-semibold text-[13px] text-text tracking-[0.02em]">工作台</span>
              <p className="text-[9px] text-text-dim/65 tracking-[0.12em] uppercase">Night console</p>
            </div>
          </div>

          <p className="px-3 text-[9px] uppercase tracking-[0.18em] text-text-dim/45 mb-1.5 mt-1 font-medium">
            模块
          </p>

          {modules.map((m) => (
            <NavLink key={m.name} to={m.path} className={linkClass}>
              <m.icon className="w-3.5 h-3.5" strokeWidth={1.7} />
              {m.name}
            </NavLink>
          ))}

          {/* Footer */}
          <div className="mt-auto pt-4">
            <div className="h-px bg-gradient-to-r from-transparent via-border/70 to-transparent mb-2" />
            <WeatherBar />
            <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] text-text-dim/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-mint" />
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
