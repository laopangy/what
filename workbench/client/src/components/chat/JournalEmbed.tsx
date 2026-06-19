import { useEffect, useRef } from "react";

export default function JournalEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wv = document.createElement("webview") as any;
    wv.src = "http://localhost:5175/embed/journal";
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
