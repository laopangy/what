import { NavLink } from "react-router-dom";
import {
   Play, Search, ListMusic, Sparkles, Heart, ListOrdered,
} from "lucide-react";
import ThemePicker from "../theme/ThemePicker";

const navItems = [
  { to: "/now-playing", icon: Play, label: "正在播放" },
  { to: "/search", icon: Search, label: "搜索" },
  { to: "/playlists", icon: ListMusic, label: "歌单" },
  { to: "/daily", icon: Sparkles, label: "每日推荐" },
  { to: "/liked", icon: Heart, label: "我喜欢的" },
  { to: "/queue", icon: ListOrdered, label: "播放队列" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-300 ${
    isActive
      ? "bg-accent/15 text-accent-dim font-semibold shadow-[0_2px_12px_rgb(244_143_177_/_0.15)] border border-accent/20"
      : "text-text-dim hover:text-text hover:bg-accent/5 border border-transparent"
  }`;

export default function Sidebar() {
  return (
    <aside className="w-56 flex flex-col glass-strong border-r border-border/60 p-4 gap-1 rounded-r-3xl">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-bold text-sm text-text">阿潘阿潘潘小主的Music</span>
          <p className="text-[10px] text-text-dim">Netease Cloud</p>
        </div>
      </div>

      {/* Nav */}
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className={linkClass}>
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}

      {/* Theme picker */}
      <div className="border-t border-border/30 pt-1">
        <ThemePicker />
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-border/30">
        <div className="px-3 py-2 flex items-center gap-2 text-[11px] text-text-dim">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          ncm-cli v0.1.5 · Online
        </div>
      </div>
    </aside>
  );
}
