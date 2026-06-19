import { useEffect, useRef } from "react";

// Electron webview — runs Tools app in a separate renderer process, no CSS/CORS issues
export default function ToolsEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create webview element programmatically for React compatibility
    const wv = document.createElement("webview") as any;
    wv.src = "http://localhost:5175/";
    wv.style.width = "100%";
    wv.style.height = "100%";
    wv.style.border = "none";
    wv.setAttribute("allowpopups", "");

    el.appendChild(wv);

    return () => {
      if (el.contains(wv)) el.removeChild(wv);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full bg-bg border-l border-border/30" />;
}
