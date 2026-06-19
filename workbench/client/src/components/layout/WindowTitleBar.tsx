import { Maximize2, Minus, Sparkles, X } from "lucide-react";

export default function WindowTitleBar() {
  const electron = window.electronAPI;
  if (!electron?.isElectron) return null;

  return (
    <header
      className="h-8 shrink-0 flex items-center justify-between bg-[#111009] border-b border-border/60 select-none [-webkit-app-region:drag]"
      onDoubleClick={() => electron.toggleMaximizeWindow()}
    >
      <div className="flex items-center gap-2 px-3 text-[10px] font-medium text-text-dim/65 tracking-wide">
        <span className="w-4 h-4 rounded bg-accent/90 flex items-center justify-center">
          <Sparkles className="w-2.5 h-2.5 text-[#17130a]" />
        </span>
        <span>阿潘阿潘潘的工作台</span>
      </div>

      <div className="h-full flex items-center [-webkit-app-region:no-drag]">
        <button
          type="button"
          aria-label="最小化"
          title="最小化"
          onClick={() => electron.minimizeWindow()}
          className="group h-full w-10 flex items-center justify-center text-text-dim/55 hover:text-text hover:bg-white/[0.05] smooth"
        >
          <Minus className="w-3.5 h-3.5 transition-transform group-hover:scale-110" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label="最大化或还原"
          title="最大化或还原"
          onClick={() => electron.toggleMaximizeWindow()}
          className="group h-full w-10 flex items-center justify-center text-text-dim/55 hover:text-accent-dim hover:bg-accent/[0.08] smooth"
        >
          <Maximize2 className="w-3 h-3 transition-transform group-hover:scale-110" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label="关闭"
          title="关闭到托盘"
          onClick={() => electron.closeWindow()}
          className="group h-full w-10 flex items-center justify-center text-text-dim/55 hover:text-white hover:bg-[#a94635] smooth"
        >
          <X className="w-3.5 h-3.5 transition-transform group-hover:scale-110" strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
