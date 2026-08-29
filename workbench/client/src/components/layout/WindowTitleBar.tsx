import { Maximize2, Minus, X } from "lucide-react";

export default function WindowTitleBar() {
  const electron = window.electronAPI;
  if (!electron?.isElectron) return null;
  return (
    <div className="qq-window-controls absolute right-0 top-0 z-50 h-14 flex items-center" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" aria-label="最小化" title="最小化" onClick={() => void electron.minimizeWindow()} className="qq-window-button"><Minus className="w-4 h-4 pointer-events-none" strokeWidth={1.5} /></button>
      <button type="button" aria-label="最大化或还原" title="最大化或还原" onClick={() => void electron.toggleMaximizeWindow()} className="qq-window-button"><Maximize2 className="w-[15px] h-[15px] pointer-events-none" strokeWidth={1.5} /></button>
      <button type="button" aria-label="关闭" title="退出应用" onClick={() => void electron.closeWindow()} className="qq-window-button hover:!bg-[#c85a5a]/80 hover:!text-white"><X className="w-4 h-4 pointer-events-none" strokeWidth={1.5} /></button>
    </div>
  );
}
