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

const colorDistance = (a: RgbColor, b: RgbColor) => {
  const red = a.r - b.r;
  const green = a.g - b.g;
  const blue = a.b - b.b;
  return red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11;
};

const colorToHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

const nearestColor = (color: RgbColor, centroids: RgbColor[]) => {
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

function clusterColors(colors: RgbColor[], requestedColors: number) {
  if (colors.length === 0) return [];

  const colorCount = Math.min(requestedColors, colors.length);
  const average = colors.reduce(
    (sum, color) => ({ r: sum.r + color.r, g: sum.g + color.g, b: sum.b + color.b }),
    { r: 0, g: 0, b: 0 },
  );
  const centroids: RgbColor[] = [
    {
      r: average.r / colors.length,
      g: average.g / colors.length,
      b: average.b / colors.length,
    },
  ];

  while (centroids.length < colorCount) {
    let farthest = colors[0];
    let farthestDistance = -1;
    colors.forEach((color) => {
      const distance = Math.min(...centroids.map((centroid) => colorDistance(color, centroid)));
      if (distance > farthestDistance) {
        farthest = color;
        farthestDistance = distance;
      }
    });
    centroids.push({ ...farthest });
  }

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const sums = centroids.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    colors.forEach((color) => {
      const index = nearestColor(color, centroids);
      sums[index].r += color.r;
      sums[index].g += color.g;
      sums[index].b += color.b;
      sums[index].count += 1;
    });

    sums.forEach((sum, index) => {
      if (sum.count > 0) {
        centroids[index] = {
          r: Math.round(sum.r / sum.count),
          g: Math.round(sum.g / sum.count),
          b: Math.round(sum.b / sum.count),
        };
      }
    });
  }

  return centroids;
}

export function createBeadPattern(
  image: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
  gridWidth: number,
  requestedColors: number,
): BeadPattern {
  const gridHeight = Math.max(1, Math.min(96, Math.round((gridWidth * naturalHeight) / naturalWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法读取图片画布");

  context.clearRect(0, 0, gridWidth, gridHeight);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, gridWidth, gridHeight);

  const data = context.getImageData(0, 0, gridWidth, gridHeight).data;
  const sourceColors: Array<RgbColor | null> = [];
  const opaqueColors: RgbColor[] = [];

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 64) {
      sourceColors.push(null);
      continue;
    }

    const color = { r: data[index], g: data[index + 1], b: data[index + 2] };
    sourceColors.push(color);
    opaqueColors.push(color);
  }

  if (opaqueColors.length === 0) throw new Error("图片中没有可识别的不透明内容");

  const centroids = clusterColors(opaqueColors, requestedColors);
  const initialCells = sourceColors.map((color) => (color ? nearestColor(color, centroids) : -1));
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
    const color = centroids[index];
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
}

export function drawBeadPattern(
  canvas: HTMLCanvasElement,
  pattern: BeadPattern,
  { cellSize, includeLegend = false, title = "拼豆规格图" }: DrawOptions,
) {
  const ruler = Math.max(26, Math.round(cellSize * 1.25));
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
  context.fillStyle = "#E7ECEF";
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
      } else {
        context.fillStyle = pattern.palette[paletteIndex].hex;
      }
      context.fillRect(x, y, cellSize, cellSize);

      if (paletteIndex >= 0 && cellSize >= 16) {
        context.fillStyle = pattern.palette[paletteIndex].textColor;
        context.font = `700 ${Math.max(8, Math.floor(cellSize * 0.38))}px ui-monospace, monospace`;
        context.fillText(String(paletteIndex + 1), x + cellSize / 2, y + cellSize / 2 + 0.5);
      }
    }
  }

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
