import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const PAGES = new Map([
  ["timer", "/timer"],
  ["timer-history", "/timer/history"],
  ["beads", "/beads"],
  ["pet", "/pet"],
  ["yunxiao", "/yunxiao"],
]);

// Electron webview — runs Tools app in a separate renderer process, no CSS/CORS issues
export default function ToolsEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const path = PAGES.get(new URLSearchParams(location.search).get("page") ?? "") ?? "/";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create webview element programmatically for React compatibility
    const wv = document.createElement("webview") as HTMLElement & { src: string };
    wv.src = `http://localhost:5175${path}`;
    wv.style.width = "100%";
    wv.style.height = "100%";
    wv.style.border = "none";
    wv.setAttribute("allowpopups", "");

    el.appendChild(wv);

    return () => {
      if (el.contains(wv)) el.removeChild(wv);
    };
  }, [path]);

  return <div ref={containerRef} className="w-full h-full bg-bg border-l border-border/30" />;
}
