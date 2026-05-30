import type { ColorCluster } from "./colorExtractor";

export interface ThemeTokens {
  accent: string;
  accentDim: string;
  purple: string;
  pink: string;
  accentMint: string;
  accentSky: string;
  accentButter: string;
  surface: string;
  surfaceRaised: string;
  surfaceGlass: string;
  border: string;
  borderGlow: string;
  text: string;
  textDim: string;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function toRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function adjustLightness(hex: string, delta: number): string {
  const { r, g, b } = hexToRgb(hex);
  const l = (Math.max(r, g, b) / 255 + Math.min(r, g, b) / 255) / 2;
  const newL = Math.max(0, Math.min(1, l + delta));
  const factor = newL / (l || 0.01);
  return hslToHex(
    0, 0, newL
  );
}

export function mapColorsToTokens(clusters: ColorCluster[]): ThemeTokens {
  const sorted = [...clusters].sort((a, b) => b.population - a.population);

  // Surface: highest lightness + lowest saturation
  const surfaceCandidates = [...sorted].sort((a, b) => {
    const scoreA = (1 - a.hsl.s) * 0.7 + a.hsl.l * 0.3;
    const scoreB = (1 - b.hsl.s) * 0.7 + b.hsl.l * 0.3;
    return scoreB - scoreA;
  });
  let surfaceColor = surfaceCandidates[0];
  if (surfaceColor.hsl.l < 0.7) {
    surfaceColor = { ...surfaceColor, hsl: { ...surfaceColor.hsl, l: 0.92, s: 0.05 }, hex: hslToHex(surfaceColor.hsl.h, 0.05, 0.92) };
  }
  if (surfaceColor.hsl.s > 0.2) {
    surfaceColor = { ...surfaceColor, hsl: { ...surfaceColor.hsl, s: 0.08 }, hex: hslToHex(surfaceColor.hsl.h, 0.08, surfaceColor.hsl.l) };
  }

  const surface = surfaceColor.hex;
  const surfaceRaised = hslToHex(surfaceColor.hsl.h, surfaceColor.hsl.s, Math.min(0.99, surfaceColor.hsl.l + 0.03));
  const surfaceGlass = toRgba(surface, 0.88);

  // Text: lowest lightness
  const textCandidates = [...sorted].sort((a, b) => a.hsl.l - b.hsl.l);
  let textColor = textCandidates[0];
  if (textColor.hsl.l > 0.4) {
    textColor = { ...textColor, hsl: { ...textColor.hsl, l: 0.25 }, hex: hslToHex(textColor.hsl.h, 0.05, 0.25) };
  }
  if (textColor.hsl.l < 0.1) {
    textColor = { ...textColor, hsl: { ...textColor.hsl, l: 0.22 }, hex: hslToHex(textColor.hsl.h, 0.05, 0.22) };
  }
  const text = textColor.hex;
  const textDim = hslToHex(textColor.hsl.h, 0.08, 0.55);

  // Accent colors: sort by saturation (desc), skip surface-like and text-like
  const accentPool = sorted.filter((c) => {
    const isSurface = c.hsl.l > 0.85 && c.hsl.s < 0.2;
    const isText = c.hsl.l < 0.3;
    return !isSurface && !isText;
  });

  const bySat = [...accentPool].sort((a, b) => b.hsl.s - a.hsl.s);

  const accent = bySat[0]?.hex ?? hslToHex(0.95, 0.3, 0.72);
  const accentDimHsl = bySat[0]?.hsl ?? { h: 0.95, s: 0.3, l: 0.72 };
  const accentDim = hslToHex(accentDimHsl.h, Math.max(0, accentDimHsl.s - 0.08), Math.max(0, accentDimHsl.l - 0.08));

  const purpleColor = bySat[1] ?? { hex: hslToHex(0.75, 0.2, 0.78), hsl: { h: 0.75, s: 0.2, l: 0.78 } };
  const purple = purpleColor.hex;

  const pinkColor = bySat[2] ?? { hex: hslToHex(0.08, 0.2, 0.82), hsl: { h: 0.08, s: 0.2, l: 0.82 } };
  const pink = pinkColor.hex;

  // Border: medium lightness, low saturation
  const borderCandidates = [...sorted]
    .filter((c) => c.hsl.l > 0.55 && c.hsl.l < 0.9)
    .sort((a, b) => a.hsl.s - b.hsl.s);
  const borderColor = borderCandidates[0] ?? { hex: toRgba(surface, 0.5), hsl: { ...surfaceColor.hsl, s: 0.1, l: 0.82 } };
  const border = borderColor.hex;
  const borderGlow = hslToHex(borderColor.hsl.h, Math.min(1, borderColor.hsl.s + 0.05), Math.min(0.95, borderColor.hsl.l + 0.02));

  // Secondary accents
  const accentMint = hslToHex(0.42, 0.15, 0.78);
  const accentSky = hslToHex(0.57, 0.15, 0.78);
  const accentButter = hslToHex(0.12, 0.2, 0.82);

  // Ensure text/surface contrast is adequate
  const surfaceL = surfaceColor.hsl.l;
  const textL = textColor.hsl.l;
  const fixedText = (surfaceL - textL < 0.45)
    ? hslToHex(textColor.hsl.h, textColor.hsl.s, Math.max(0.1, surfaceL - 0.55))
    : text;

  return {
    accent,
    accentDim,
    purple,
    pink,
    accentMint,
    accentSky,
    accentButter,
    surface,
    surfaceRaised,
    surfaceGlass,
    border,
    borderGlow,
    text: fixedText,
    textDim,
  };
}
