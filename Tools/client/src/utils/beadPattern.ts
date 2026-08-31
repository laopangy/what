export interface BeadColor {
  code: string;
  hex: string;
  rgb: [number, number, number];
  count: number;
  textColor: "#172027" | "#f3f6f7";
}

export interface BeadPattern {
  width: number;
  height: number;
  cells: number[];
  palette: BeadColor[];
  totalBeads: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface LabColor {
  l: number;
  a: number;
  b: number;
}

interface SampleColor {
  rgb: RgbColor;
  lab: LabColor;
  weight: number;
}

export type DetailMode = "soft" | "balanced" | "sharp";

interface CreatePatternOptions {
  gridWidth: number;
  gridHeight?: number;
  requestedColors: number;
  detailMode?: DetailMode;
}

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const rgbToLab = ({ r, g, b }: RgbColor): LabColor => {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const red = linearize(r);
  const green = linearize(g);
  const blue = linearize(b);
  const x = (red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047;
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175;
  const z = (red * 0.0193339 + green * 0.119192 + blue * 0.9503041) / 1.08883;
  const transform = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
};

const colorDistance = (a: LabColor, b: LabColor) => {
  const lightness = a.l - b.l;
  const greenRed = a.a - b.a;
  const blueYellow = a.b - b.b;
  return lightness * lightness + greenRed * greenRed + blueYellow * blueYellow;
};

const colorToHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

const nearestColor = (color: LabColor, centroids: LabColor[]) => {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;

  centroids.forEach((centroid, index) => {
    const nextDistance = colorDistance(color, centroid);
    if (nextDistance < distance) {
      nearest = index;
      distance = nextDistance;
    }
  });

  return nearest;
};

function clusterColors(colors: SampleColor[], requestedColors: number) {
  if (colors.length === 0) return [];

  const colorCount = Math.min(requestedColors, colors.length);
  const average = colors.reduce(
    (sum, color) => ({
      l: sum.l + color.lab.l * color.weight,
      a: sum.a + color.lab.a * color.weight,
      b: sum.b + color.lab.b * color.weight,
      weight: sum.weight + color.weight,
    }),
    { l: 0, a: 0, b: 0, weight: 0 },
  );
  const centroids: LabColor[] = [
    {
      l: average.l / average.weight,
      a: average.a / average.weight,
      b: average.b / average.weight,
    },
  ];

  while (centroids.length < colorCount) {
    let farthest = colors[0].lab;
    let farthestDistance = -1;
    colors.forEach((color) => {
      const distance = Math.min(...centroids.map((centroid) => colorDistance(color.lab, centroid))) * color.weight;
      if (distance > farthestDistance) {
        farthest = color.lab;
        farthestDistance = distance;
      }
    });
    centroids.push({ ...farthest });
  }

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, weight: 0 }));
    colors.forEach((color) => {
      const index = nearestColor(color.lab, centroids);
      sums[index].l += color.lab.l * color.weight;
      sums[index].a += color.lab.a * color.weight;
      sums[index].b += color.lab.b * color.weight;
      sums[index].weight += color.weight;
    });

    sums.forEach((sum, index) => {
      if (sum.weight > 0) {
        centroids[index] = {
          l: sum.l / sum.weight,
          a: sum.a / sum.weight,
          b: sum.b / sum.weight,
        };
      }
    });
  }

  return centroids.map((centroid) => {
    const assigned = colors.filter(
      (color) => nearestColor(color.lab, centroids) === centroids.indexOf(centroid),
    );
    const totalWeight = assigned.reduce((sum, color) => sum + color.weight, 0) || 1;
    return {
      rgb: {
        r: assigned.reduce((sum, color) => sum + color.rgb.r * color.weight, 0) / totalWeight,
        g: assigned.reduce((sum, color) => sum + color.rgb.g * color.weight, 0) / totalWeight,
        b: assigned.reduce((sum, color) => sum + color.rgb.b * color.weight, 0) / totalWeight,
      },
      lab: centroid,
    };
  });
}

function enhancePixels(data: Uint8ClampedArray, width: number, height: number, mode: DetailMode) {
  if (mode === "soft") return data;
  const source = new Uint8ClampedArray(data);
  const sharpen = mode === "sharp" ? 0.42 : 0.24;
  const saturation = mode === "sharp" ? 1.12 : 1.06;

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const index = (row * width + column) * 4;
      if (source[index + 3] < 64) continue;
      const left = (row * width + Math.max(0, column - 1)) * 4;
      const right = (row * width + Math.min(width - 1, column + 1)) * 4;
      const top = (Math.max(0, row - 1) * width + column) * 4;
      const bottom = (Math.min(height - 1, row + 1) * width + column) * 4;
      const enhanced = [0, 1, 2].map((channel) =>
        source[index + channel] * (1 + sharpen * 4)
          - (source[left + channel] + source[right + channel] + source[top + channel] + source[bottom + channel]) * sharpen,
      );
      const luminance = enhanced[0] * 0.299 + enhanced[1] * 0.587 + enhanced[2] * 0.114;
      data[index] = clampChannel(luminance + (enhanced[0] - luminance) * saturation);
      data[index + 1] = clampChannel(luminance + (enhanced[1] - luminance) * saturation);
      data[index + 2] = clampChannel(luminance + (enhanced[2] - luminance) * saturation);
    }
  }
  return data;
}

export function createBeadPattern(
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  { gridWidth, gridHeight: requestedGridHeight, requestedColors, detailMode = "balanced" }: CreatePatternOptions,
): BeadPattern {
  const gridHeight = Math.max(
    1,
    Math.min(
      240,
      Math.round(requestedGridHeight ?? (gridWidth * naturalHeight) / naturalWidth),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法读取图片画布");

  context.clearRect(0, 0, gridWidth, gridHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, gridWidth, gridHeight);

  const data = enhancePixels(
    context.getImageData(0, 0, gridWidth, gridHeight).data,
    gridWidth,
    gridHeight,
    detailMode,
  );
  const sourceColors: Array<RgbColor | null> = [];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 64) {
      sourceColors.push(null);
      continue;
    }

    const color = { r: data[index], g: data[index + 1], b: data[index + 2] };
    sourceColors.push(color);
  }

  const opaqueColors = sourceColors.flatMap((color, index): SampleColor[] => {
    if (!color) return [];
    const lab = rgbToLab(color);
    const column = index % gridWidth;
    const neighbors = [
      column > 0 ? sourceColors[index - 1] : null,
      index >= gridWidth ? sourceColors[index - gridWidth] : null,
    ].filter((neighbor): neighbor is RgbColor => neighbor !== null);
    const edgeWeight = neighbors.reduce(
      (maximum, neighbor) => Math.max(maximum, Math.sqrt(colorDistance(lab, rgbToLab(neighbor))) / 10),
      0,
    );
    const chromaWeight = Math.min(0.5, Math.sqrt(lab.a * lab.a + lab.b * lab.b) / 140);
    return [{ rgb: color, lab, weight: 1 + Math.min(3, edgeWeight) + chromaWeight }];
  });

  if (opaqueColors.length === 0) throw new Error("图片中没有可识别的不透明内容");

  const centroids = clusterColors(opaqueColors, requestedColors);
  const initialCells = sourceColors.map((color) =>
    color ? nearestColor(rgbToLab(color), centroids.map((centroid) => centroid.lab)) : -1,
  );
  const counts = centroids.map(() => 0);
  initialCells.forEach((index) => {
    if (index >= 0) counts[index] += 1;
  });

  const sortedIndices = counts
    .map((count, index) => ({ count, index }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count);
  const remap = new Map(sortedIndices.map(({ index }, sortedIndex) => [index, sortedIndex]));

  const palette = sortedIndices.map(({ count, index }, sortedIndex): BeadColor => {
    const color = centroids[index].rgb;
    const luminance = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
    return {
      code: `P${String(sortedIndex + 1).padStart(2, "0")}`,
      hex: colorToHex(color),
      rgb: [color.r, color.g, color.b],
      count,
      textColor: luminance > 155 ? "#172027" : "#f3f6f7",
    };
  });

  return {
    width: gridWidth,
    height: gridHeight,
    cells: initialCells.map((index) => (index < 0 ? -1 : remap.get(index) ?? -1)),
    palette,
    totalBeads: opaqueColors.length,
  };
}

interface DrawOptions {
  cellSize: number;
  includeLegend?: boolean;
  title?: string;
  mode?: "beads" | "chart";
}

export function drawBeadPattern(
  canvas: HTMLCanvasElement,
  pattern: BeadPattern,
  { cellSize, includeLegend = false, title = "拼豆规格图", mode = "chart" }: DrawOptions,
) {
  const ruler = mode === "beads" ? 0 : Math.max(26, Math.round(cellSize * 1.25));
  const header = includeLegend ? 74 : 0;
  const legendColumns = Math.min(4, Math.max(1, Math.floor(pattern.width * cellSize / 240)));
  const legendRows = Math.ceil(pattern.palette.length / legendColumns);
  const legendHeight = includeLegend ? 54 + legendRows * 42 : 0;
  const patternWidth = pattern.width * cellSize;
  const patternHeight = pattern.height * cellSize;
  const width = ruler + patternWidth + 2;
  const height = header + ruler + patternHeight + legendHeight + 2;
  const context = canvas.getContext("2d");
  if (!context) return;

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = mode === "beads" ? "#BAC5CB" : "#E7ECEF";
  context.fillRect(0, 0, width, height);

  if (includeLegend) {
    context.fillStyle = "#344049";
    context.font = "700 26px Segoe UI, sans-serif";
    context.fillText(title, ruler, 32);
    context.fillStyle = "#697983";
    context.font = "14px Segoe UI, sans-serif";
    context.fillText(`${pattern.width} x ${pattern.height} 颗 / ${pattern.totalBeads} 颗 / ${pattern.palette.length} 色`, ruler, 56);
  }

  const originX = ruler;
  const originY = header + ruler;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (let row = 0; row < pattern.height; row += 1) {
    for (let column = 0; column < pattern.width; column += 1) {
      const paletteIndex = pattern.cells[row * pattern.width + column];
      const x = originX + column * cellSize;
      const y = originY + row * cellSize;
      if (paletteIndex < 0) {
        context.fillStyle = (row + column) % 2 === 0 ? "#F3F6F7" : "#DCE3E7";
      } else if (mode === "beads") {
        context.fillStyle = pattern.palette[paletteIndex].hex;
        context.fillRect(x, y, cellSize, cellSize);
      } else {
        context.fillStyle = pattern.palette[paletteIndex].hex;
      }
      if (paletteIndex < 0 || mode === "chart") context.fillRect(x, y, cellSize, cellSize);

      if (mode === "chart" && paletteIndex >= 0 && cellSize >= 16) {
        context.fillStyle = pattern.palette[paletteIndex].textColor;
        context.font = `700 ${Math.max(8, Math.floor(cellSize * 0.38))}px ui-monospace, monospace`;
        context.fillText(String(paletteIndex + 1), x + cellSize / 2, y + cellSize / 2 + 0.5);
      }
    }
  }

  if (mode === "beads") return;

  context.strokeStyle = "rgba(52, 64, 73, 0.32)";
  context.lineWidth = 1;
  for (let column = 0; column <= pattern.width; column += 1) {
    const x = originX + column * cellSize + 0.5;
    context.beginPath();
    context.moveTo(x, originY);
    context.lineTo(x, originY + patternHeight);
    context.stroke();
  }
  for (let row = 0; row <= pattern.height; row += 1) {
    const y = originY + row * cellSize + 0.5;
    context.beginPath();
    context.moveTo(originX, y);
    context.lineTo(originX + patternWidth, y);
    context.stroke();
  }

  context.fillStyle = "#586873";
  context.font = "11px ui-monospace, monospace";
  for (let column = 0; column < pattern.width; column += 1) {
    if (column === 0 || (column + 1) % 5 === 0 || column === pattern.width - 1) {
      context.fillText(String(column + 1), originX + column * cellSize + cellSize / 2, originY - ruler / 2);
    }
  }
  for (let row = 0; row < pattern.height; row += 1) {
    if (row === 0 || (row + 1) % 5 === 0 || row === pattern.height - 1) {
      context.fillText(String(row + 1), originX - ruler / 2, originY + row * cellSize + cellSize / 2);
    }
  }

  if (!includeLegend) return;

  const legendTop = originY + patternHeight + 30;
  const columnWidth = patternWidth / legendColumns;
  pattern.palette.forEach((color, index) => {
    const column = index % legendColumns;
    const row = Math.floor(index / legendColumns);
    const x = originX + column * columnWidth;
    const y = legendTop + row * 42;
    context.fillStyle = color.hex;
    context.fillRect(x, y, 26, 26);
    context.strokeStyle = "rgba(52, 64, 73, 0.4)";
    context.strokeRect(x + 0.5, y + 0.5, 25, 25);
    context.textAlign = "left";
    context.fillStyle = "#344049";
    context.font = "700 12px ui-monospace, monospace";
    context.fillText(color.code, x + 36, y + 9);
    context.fillStyle = "#697983";
    context.font = "11px ui-monospace, monospace";
    context.fillText(`${color.hex} / ${color.count} 颗`, x + 36, y + 23);
  });
}
