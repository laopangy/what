import { useState, type FormEvent, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronRight, Dumbbell, Home, Mountain, Music, Radio, RefreshCw, Search, Settings, Sparkles, Wrench } from "lucide-react";
import WindowTitleBar from "./WindowTitleBar";

const modules = [
  { name: "AI 对话", icon: Home, path: "/" },
  { name: "音乐", icon: Radio, path: "/music" },
  { name: "随手记", icon: BookOpen, path: "/journal" },
  { name: "户外", icon: Mountain, path: "/outdoor" },
  { name: "肌肉大", icon: Dumbbell, path: "/fitness" },
  { name: "工具", icon: Wrench, path: "/tools" },
];

export default function WorkbenchLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    if (query) navigate(`/music?query=${encodeURIComponent(query)}`);
  };

  return (
    <div className="qq-shell h-screen min-h-[560px] overflow-hidden bg-bg text-text">
      <aside className="qq-rail fixed inset-y-0 left-0 z-40 w-[78px] flex flex-col items-center border-r border-white/[0.07] bg-surface/55 backdrop-blur-2xl">
        <button onClick={() => navigate("/")} className="relative mt-4 mb-4 w-9 h-9 rounded-full bg-[linear-gradient(145deg,#708694,#3e4a51)] text-white text-[11px] font-semibold shadow-[0_8px_24px_rgb(12_24_31_/.24)]" title="返回主页">
          潘<span className="absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full bg-accent border-2 border-[#62727d]" />
        </button>
        <nav className="flex flex-col items-center gap-1.5" aria-label="工作台模块">
          {modules.map((module, index) => (
            <NavLink key={`${module.name}-${index}`} to={module.path} end={module.path === "/"} aria-label={module.name} title={module.name}
              className={({ isActive }) => `qq-rail-link group relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${isActive ? "bg-white/[0.14] text-white" : "text-white/62 hover:text-white hover:bg-white/[0.09]"}`}>
              <module.icon className="w-[19px] h-[19px]" strokeWidth={1.65} />
              <span className="pointer-events-none absolute left-[58px] whitespace-nowrap rounded-md bg-[#26323a]/92 px-2 py-1 text-[10px] text-white opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shadow-xl">{module.name}</span>
            </NavLink>
          ))}
        </nav>
        <button onClick={() => navigate("/music?view=settings")} className="mt-auto mb-4 w-10 h-10 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.09] transition-colors" title="设置">
          <Settings className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>
      </aside>

      <section className="ml-[78px] h-full relative overflow-hidden">
        <header className="absolute inset-x-0 top-0 z-30 h-14 flex items-center gap-1 px-5 pr-36 text-white/62 [-webkit-app-region:drag]">
          <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
            <button onClick={() => navigate(-1)} className="qq-top-button" title="返回"><ArrowLeft className="w-[19px] h-[19px]" /></button>
            <button onClick={() => navigate(1)} className="qq-top-button" title="前进"><ChevronRight className="w-[20px] h-[20px]" /></button>
            <button onClick={() => window.location.reload()} className="qq-top-button" title="刷新"><RefreshCw className="w-[18px] h-[18px]" /></button>
          </div>
          <form onSubmit={submitSearch} className="ml-2 w-[min(36vw,480px)] h-9 rounded-xl bg-white/[0.12] hover:bg-white/[0.16] focus-within:bg-white/[0.18] flex items-center gap-2 px-3 transition-colors [-webkit-app-region:no-drag]">
            <button type="submit" aria-label="搜索" title="搜索" className="text-white/45 hover:text-white/80 transition-colors"><Search className="w-4 h-4" /></button>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索音乐" className="min-w-0 flex-1 bg-transparent outline-none text-xs text-white/82 placeholder:text-white/42" />
          </form>
          <div className="ml-3 hidden lg:flex items-center gap-2 text-[11px] text-white/68 [-webkit-app-region:no-drag]">
            <span className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center"><Music className="w-3.5 h-3.5 text-accent" /></span>
            <span className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-accent" /></span>
            <button onClick={() => navigate("/music?view=settings")} className="hover:text-white transition-colors">账号与服务</button>
          </div>
          <WindowTitleBar />
        </header>
        <main className="h-full overflow-hidden pt-14">{children}</main>
      </section>
    </div>
  );
}
