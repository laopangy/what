import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Electron webview — runs Music app in a separate renderer process, no CSS/CORS issues
export default function MusicEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const query = params.get("query");
  const view = params.get("view");
  const target = view === "settings" ? "/settings" : query ? `/search?query=${encodeURIComponent(query)}` : "/";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create webview element programmatically for React compatibility
    const wv = document.createElement("webview") as any;
    wv.src = `http://localhost:5173${target}${target.includes("?") ? "&" : "?"}embedded=1`;
    wv.style.width = "100%";
    wv.style.height = "100%";
    wv.style.border = "none";
    wv.setAttribute("allowpopups", "");

    el.appendChild(wv);

    return () => {
      if (el.contains(wv)) el.removeChild(wv);
    };
  }, [target]);

  return <div ref={containerRef} className="w-full h-full bg-bg" />;
}
