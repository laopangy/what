export interface ColorCluster {
  hex: string;
  hsl: { h: number; s: number; l: number };
  population: number;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
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

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function perceptualDistance(
  a: { h: number; s: number; l: number },
  b: { h: number; s: number; l: number }
): number {
  const dh = hueDistance(a.h, b.h) * 2.0;
  const ds = Math.abs(a.s - b.s) * 1.5;
  const dl = Math.abs(a.l - b.l) * 1.0;
  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

export async function extractColors(url: string, k = 10): Promise<ColorCluster[]> {
  const img = await loadImage(url);

  const maxDim = 200;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > maxDim || h > maxDim) {
    const ratio = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const sampled: { r: number; g: number; b: number; hsl: { h: number; s: number; l: number } }[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
    if (a < 128) continue;
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 15 && g < 15 && b < 15) continue;
    sampled.push({ r, g, b, hsl: rgbToHsl(r, g, b) });
  }

  if (sampled.length === 0) return [];

  // Initialize centroids evenly around the hue circle
  const centroids: { h: number; s: number; l: number }[] = [];
  for (let i = 0; i < k; i++) {
    centroids.push({ h: i / k, s: 0.5, l: 0.5 });
  }

  const assignments = new Array<number>(sampled.length);
  for (let iter = 0; iter < 15; iter++) {
    // Assign
    for (let i = 0; i < sampled.length; i++) {
      let minDist = Infinity;
      let best = 0;
      for (let j = 0; j < k; j++) {
        const d = perceptualDistance(sampled[i].hsl, centroids[j]);
        if (d < minDist) { minDist = d; best = j; }
      }
      assignments[i] = best;
    }
    // Update
    const sums = Array.from({ length: k }, () => ({ h: 0, s: 0, l: 0, count: 0 }));
    for (let i = 0; i < sampled.length; i++) {
      const c = assignments[i];
      sums[c].h += sampled[i].hsl.h;
      sums[c].s += sampled[i].hsl.s;
      sums[c].l += sampled[i].hsl.l;
      sums[c].count++;
    }
    for (let j = 0; j < k; j++) {
      if (sums[j].count > 0) {
        centroids[j] = {
          h: sums[j].h / sums[j].count,
          s: sums[j].s / sums[j].count,
          l: sums[j].l / sums[j].count,
        };
      }
    }
  }

  // Build clusters
  const clusters: ColorCluster[] = centroids
    .map((c, i) => {
      const count = assignments.filter((a) => a === i).length;
      return {
        hex: hslToHex(c.h, c.s, c.l),
        hsl: c,
        population: count / sampled.length,
      };
    })
    .filter((c) => c.population > 0.01)
    .sort((a, b) => b.population - a.population);

  // Filter to clusters covering at least 80% of pixels
  let cumulative = 0;
  const result: ColorCluster[] = [];
  for (const c of clusters) {
    result.push(c);
    cumulative += c.population;
    if (cumulative >= 0.8) break;
  }

  return result.length >= 3 ? result : clusters.slice(0, Math.max(3, clusters.length));
}
