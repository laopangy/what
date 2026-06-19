import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Wrench, Clock, History } from "lucide-react";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-500/12 text-indigo-400 shadow-[inset_2px_0_0_#d99a16] border border-indigo-500/20"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
    }`;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 relative">
      {/* Sidebar */}
      <aside className="w-52 border-r border-slate-800 bg-slate-900/90 flex flex-col p-3 shadow-[12px_0_30px_rgb(0_0_0_/_0.18)]">
        {/* Header */}
        <NavLink to="/" className="flex items-center gap-2.5 px-2 py-2 mb-4 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-[#17130a]" />
          </div>
          <span className="font-semibold text-slate-200">工具</span>
        </NavLink>

        {/* Tool list */}
        <div className="mb-4">
          <p className="px-3 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            定时任务
          </p>
          <nav className="flex flex-col gap-1">
            <NavLink to="/timer" className={linkClass} end>
              <Clock className="w-4 h-4" />
              定时器
            </NavLink>
            <NavLink to="/timer/history" className={linkClass}>
              <History className="w-4 h-4" />
              执行历史
            </NavLink>
          </nav>
        </div>

        {/* Future tools placeholder */}
        <div className="mb-4">
          <p className="px-3 text-xs font-medium text-slate-600 uppercase tracking-wider mb-2">
            更多工具
          </p>
          <div className="px-3 py-2 text-xs text-slate-600 italic">
            即将推出...
          </div>
        </div>

      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
