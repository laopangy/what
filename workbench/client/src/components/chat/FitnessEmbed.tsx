import { useEffect, useRef } from "react";

export default function FitnessEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const webview = document.createElement("webview") as HTMLElement & { src: string };
    webview.src = "http://localhost:5176/";
    webview.style.width = "100%";
    webview.style.height = "100%";
    webview.style.border = "none";
    webview.setAttribute("allowpopups", "");
    container.appendChild(webview);
    return () => { if (container.contains(webview)) container.removeChild(webview); };
  }, []);

  return <div ref={containerRef} className="w-full h-full bg-bg border-l border-border/30" />;
}
