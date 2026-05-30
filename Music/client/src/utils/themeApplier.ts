import type { ThemeTokens } from "./colorMapper";

const TOKENS = [
  "accent", "accentDim", "purple", "pink",
  "accentMint", "accentSky", "accentButter",
  "surface", "surfaceRaised", "surfaceGlass",
  "border", "borderGlow", "text", "textDim",
] as const;

function getOrCreateStyle(id: string): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  return el;
}

function parseRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function applyTheme(tokens: ThemeTokens, imageUrl?: string): void {
  const root = document.documentElement;
  for (const key of TOKENS) {
    root.style.setProperty(`--color-${key}`, tokens[key]);
  }
  root.style.setProperty("--color-bg", tokens.surface);
  document.body.style.backgroundColor = tokens.surface;
  document.body.style.color = tokens.text;

  const [br, bg, bb] = parseRgb(tokens.border);
  const [sr, sg, sb] = parseRgb(tokens.surface);

  if (imageUrl) {
    // Background image on ::before (no blur), light overlay + dots on ::after
    const styleEl = getOrCreateStyle("theme-bg-image");
    styleEl.textContent = [
      `body::before{`,
      `content:"";position:fixed;inset:0;z-index:0;pointer-events:none;`,
      `background:url("${imageUrl}") center/cover fixed;`,
      `}`,
      `body::after{`,
      `content:"";position:fixed;inset:0;z-index:0;pointer-events:none;`,
      `background:`,
      `radial-gradient(circle,rgba(${br},${bg},${bb},0.12) 1px,transparent 1px),`,
      `linear-gradient(rgba(${sr},${sg},${sb},0.35),rgba(${sr},${sg},${sb},0.4));`,
      `background-size:40px 40px,100% 100%;`,
      `}`,
    ].join("");
  } else {
    // Default: only dots on ::after, ::before is empty
    document.getElementById("theme-bg-image")?.remove();
    getOrCreateStyle("theme-dot-pattern").textContent =
      `body::after{background-image:radial-gradient(circle,rgba(${br},${bg},${bb},0.15) 1px,transparent 1px)!important;background-size:40px 40px!important}`;
    // Clear ::before
    const beforeEl = document.getElementById("theme-bg-image");
    if (!beforeEl) {
      // ::before should be empty in default state
      // It's already empty from index.css, just ensure no stale styles
    }
  }
}

export function resetTheme(): void {
  const root = document.documentElement;
  for (const key of TOKENS) {
    root.style.removeProperty(`--color-${key}`);
  }
  root.style.removeProperty("--color-bg");
  document.body.style.backgroundColor = "";
  document.body.style.color = "";

  document.getElementById("theme-dot-pattern")?.remove();
  document.getElementById("theme-bg-image")?.remove();
}
