import { useEffect, useRef, useState } from "react";
import {
  Download,
  Grid3X3,
  ImageDown,
  ImagePlus,
  Info,
  LayoutGrid,
  Link2,
  Maximize2,
  Palette,
  RotateCcw,
  Sparkles,
  Unlink2,
  Upload,
  X,
} from "lucide-react";
import {
  createBeadPattern,
  drawBeadPattern,
  type BeadPattern,
  type DetailMode,
} from "../../utils/beadPattern";

const GRID_SIZES = [48, 64, 80, 96, 128, 160];
const MIN_GRID_SIZE = 8;
const MAX_GRID_SIZE = 240;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const clampGridSize = (value: number) =>
  Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, Math.round(value)));

interface LoadedImage {
  element: HTMLImageElement;
  name: string;
  width: number;
  height: number;
  previewUrl: string;
}

export default function BeadPatternMaker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [pattern, setPattern] = useState<BeadPattern | null>(null);
  const [gridWidth, setGridWidth] = useState(128);
  const [gridHeight, setGridHeight] = useState(72);
  const [aspectLocked, setAspectLocked] = useState(true);
  const [colorCount, setColorCount] = useState(32);
  const [detailMode, setDetailMode] = useState<DetailMode>("balanced");
  const [viewMode, setViewMode] = useState<"beads" | "chart">("beads");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
  }, [image]);

  useEffect(() => {
    if (!image) {
      setPattern(null);
      return;
    }

    setProcessing(true);
    setError(null);
    const frame = requestAnimationFrame(() => {
      try {
        setPattern(createBeadPattern(image.element, image.width, image.height, {
          gridWidth,
          gridHeight,
          requestedColors: colorCount,
          detailMode,
        }));
      } catch (cause) {
        setPattern(null);
        setError(cause instanceof Error ? cause.message : "生成规格图失败，请换一张图片重试");
      } finally {
        setProcessing(false);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [colorCount, detailMode, gridHeight, gridWidth, image]);

  useEffect(() => {
    if (!pattern || !canvasRef.current) return;
    const cellSize = Math.max(5, Math.min(18, Math.floor(920 / pattern.width)));
    drawBeadPattern(canvasRef.current, pattern, { cellSize, mode: viewMode });
  }, [pattern, viewMode]);

  useEffect(() => {
    if (!previewOpen || !pattern || !previewCanvasRef.current) return;
    const cellSize = Math.max(8, Math.min(18, Math.floor(1920 / pattern.width)));
    drawBeadPattern(previewCanvasRef.current, pattern, { cellSize, mode: "beads" });
  }, [pattern, previewOpen]);

  useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewOpen]);

  const loadFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请选择 PNG、JPG 或 WebP 图片");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("图片不能超过 20 MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      const nextGridWidth = element.naturalWidth >= 1600 ? 128 : 80;
      setGridWidth(nextGridWidth);
      setGridHeight(
        clampGridSize((nextGridWidth * element.naturalHeight) / element.naturalWidth),
      );
      setAspectLocked(true);
      if (element.naturalWidth >= 1600) {
        setColorCount(32);
      } else {
        setColorCount(24);
      }
      setImage((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return {
          element,
          name: file.name,
          width: element.naturalWidth,
          height: element.naturalHeight,
          previewUrl,
        };
      });
      setError(null);
    };
    element.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      setError("无法读取这张图片，请换一个文件重试");
    };
    element.src = previewUrl;
  };

  const proportionalHeight = (width: number) =>
    clampGridSize(width * (image ? image.height / image.width : 9 / 16));

  const proportionalWidth = (height: number) =>
    clampGridSize(height * (image ? image.width / image.height : 16 / 9));

  const updateGridWidth = (value: number) => {
    const nextWidth = clampGridSize(value);
    setGridWidth(nextWidth);
    if (aspectLocked) setGridHeight(proportionalHeight(nextWidth));
  };

  const updateGridHeight = (value: number) => {
    const nextHeight = clampGridSize(value);
    setGridHeight(nextHeight);
    if (aspectLocked) setGridWidth(proportionalWidth(nextHeight));
  };

  const toggleAspectLock = () => {
    setAspectLocked((locked) => {
      if (!locked) setGridHeight(proportionalHeight(gridWidth));
      return !locked;
    });
  };

  const recommendedGridHeight = proportionalHeight(gridWidth);
  const sourceAspectRatio = image ? image.width / image.height : 16 / 9;
  const ratioDeviation = Math.abs(gridWidth / gridHeight - sourceAspectRatio) / sourceAspectRatio;
  const ratioMatches = ratioDeviation <= 0.015;

  const applyRecommendedRatio = () => {
    setGridHeight(recommendedGridHeight);
  };

  const reset = () => {
    setImage((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setPattern(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadPattern = () => {
    if (!pattern || !image) return;
    const exportCanvas = document.createElement("canvas");
    drawBeadPattern(exportCanvas, pattern, {
      cellSize: Math.max(16, Math.min(30, Math.floor(3600 / pattern.width))),
      includeLegend: true,
      title: image.name.replace(/\.[^.]+$/, ""),
    });
    const link = document.createElement("a");
    link.download = `${image.name.replace(/\.[^.]+$/, "")}-拼豆规格图.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  const downloadFinishedPreview = () => {
    if (!pattern || !image) return;
    const exportCanvas = document.createElement("canvas");
    drawBeadPattern(exportCanvas, pattern, {
      cellSize: Math.max(10, Math.min(20, Math.floor(2400 / pattern.width))),
      mode: "beads",
    });
    const link = document.createElement("a");
    link.download = `${image.name.replace(/\.[^.]+$/, "")}-拼豆成片.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-400">
            <Grid3X3 className="h-4 w-4" strokeWidth={1.8} />
            图案转换工具
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">拼豆规格图</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-slate-400">
            上传图片，自动生成带格号、色号和用量统计的拼豆图纸。所有处理都在本机完成。
          </p>
        </div>
        {pattern && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-semibold text-slate-100 transition-colors hover:border-indigo-500/50"
            >
              <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
              成片预览
            </button>
            <button
              type="button"
              onClick={downloadPattern}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 font-semibold text-[#172027] transition-colors hover:bg-indigo-400"
            >
              <Download className="h-4 w-4" strokeWidth={1.8} />
              下载规格图
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-[0_12px_28px_rgb(20_30_36_/_0.18)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-100">原始图片</h2>
              {image && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                  清空
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => loadFile(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                loadFile(event.dataTransfer.files[0]);
              }}
              className={`group relative flex min-h-44 w-full overflow-hidden rounded-xl border border-dashed transition-colors ${
                dragging
                  ? "border-indigo-400 bg-indigo-500/10"
                  : "border-slate-700 bg-slate-950/35 hover:border-indigo-500/60 hover:bg-slate-950/55"
              }`}
            >
              {image ? (
                <>
                  <img src={image.previewUrl} alt="已上传的原始图片" className="h-44 w-full object-contain p-3" />
                  <span className="absolute inset-x-3 bottom-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950/90 px-3 py-2 text-xs font-medium text-slate-200 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.8} />
                    更换图片
                  </span>
                </>
              ) : (
                <span className="m-auto flex flex-col items-center px-5 text-center">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/12 text-indigo-400">
                    <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="font-medium text-slate-200">拖入图片或点击选择</span>
                  <span className="mt-1 text-xs text-slate-500">PNG、JPG、WebP，最大 20 MB</span>
                </span>
              )}
            </button>
            {image && (
              <p className="mt-2 truncate text-xs text-slate-500" title={image.name}>
                {image.name} / {image.width} x {image.height}px
              </p>
            )}
            {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-[0_12px_28px_rgb(20_30_36_/_0.18)]">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" strokeWidth={1.8} />
              <h2 className="font-semibold text-slate-100">图纸设置</h2>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-400">常用横向豆数</legend>
              <div className="grid grid-cols-3 gap-2">
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateGridWidth(size)}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                      gridWidth === size
                        ? "border-indigo-500 bg-indigo-500 text-[#172027]"
                        : "border-slate-800 bg-slate-950/35 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
                <label className="min-w-0 text-[11px] font-medium text-slate-500">
                  横向
                  <input
                    type="number"
                    min={MIN_GRID_SIZE}
                    max={MAX_GRID_SIZE}
                    value={gridWidth}
                    onChange={(event) => {
                      if (Number.isFinite(event.target.valueAsNumber)) {
                        updateGridWidth(event.target.valueAsNumber);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2 font-mono text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-indigo-500"
                    aria-label="横向豆数"
                  />
                </label>
                <span className="pb-2.5 text-xs text-slate-600">×</span>
                <label className="min-w-0 text-[11px] font-medium text-slate-500">
                  纵向
                  <input
                    type="number"
                    min={MIN_GRID_SIZE}
                    max={MAX_GRID_SIZE}
                    value={gridHeight}
                    onChange={(event) => {
                      if (Number.isFinite(event.target.valueAsNumber)) {
                        updateGridHeight(event.target.valueAsNumber);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-2 font-mono text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-indigo-500"
                    aria-label="纵向豆数"
                  />
                </label>
                <button
                  type="button"
                  onClick={toggleAspectLock}
                  className={`mb-px inline-flex h-[38px] w-[38px] items-center justify-center rounded-lg border transition-colors ${
                    aspectLocked
                      ? "border-indigo-500/70 bg-indigo-500/15 text-indigo-300"
                      : "border-slate-700 bg-slate-950/50 text-slate-500 hover:text-slate-300"
                  }`}
                  aria-label={aspectLocked ? "解除原图比例锁定" : "锁定为原图比例"}
                  title={aspectLocked ? "已锁定原图比例" : "自由设置宽高"}
                >
                  {aspectLocked ? (
                    <Link2 className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Unlink2 className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                {aspectLocked
                  ? "已按原图比例联动，修改任一边都会自动计算另一边。"
                  : `宽高可独立设置，范围 ${MIN_GRID_SIZE}–${MAX_GRID_SIZE}。`}
              </p>

              {image && (
                <div
                  className={`mt-3 rounded-lg border px-3 py-2.5 ${
                    ratioMatches
                      ? "border-emerald-500/25 bg-emerald-500/8"
                      : "border-amber-500/35 bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Info
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                        ratioMatches ? "text-emerald-400" : "text-amber-400"
                      }`}
                      strokeWidth={1.8}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          ratioMatches ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {ratioMatches ? "当前比例与原图匹配" : "当前比例可能拉伸画面"}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        按当前横向豆数，推荐规格为
                        <span className="ml-1 font-mono font-semibold text-slate-300">
                          {gridWidth} × {recommendedGridHeight}
                        </span>
                        {!ratioMatches && `，当前偏差约 ${Math.round(ratioDeviation * 100)}%`}
                      </p>
                    </div>
                    {!ratioMatches && (
                      <button
                        type="button"
                        onClick={applyRecommendedRatio}
                        className="shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
                      >
                        使用推荐
                      </button>
                    )}
                  </div>
                </div>
              )}
            </fieldset>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="bead-color-count" className="text-xs font-medium text-slate-400">
                  最大颜色数
                </label>
                <span className="font-mono text-sm font-bold text-indigo-400">{colorCount}</span>
              </div>
              <input
                id="bead-color-count"
                type="range"
                min="8"
                max="48"
                step="1"
                value={colorCount}
                onChange={(event) => setColorCount(Number(event.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-600">
                <span>更简洁</span>
                <span>更细腻</span>
              </div>
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-xs font-medium text-slate-400">细节处理</legend>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "soft", label: "柔和" },
                  { value: "balanced", label: "均衡" },
                  { value: "sharp", label: "锐利" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDetailMode(option.value)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      detailMode === option.value
                        ? "border-indigo-500 bg-indigo-500 text-[#172027]"
                        : "border-slate-800 bg-slate-950/35 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 flex gap-2 rounded-lg bg-slate-950/35 p-3 text-xs leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />
              复杂场景建议使用 96-160 横豆。豆数越高，人物五官和轮廓越清楚，但成品也会更大。
            </div>
          </section>
        </aside>

        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900 shadow-[0_14px_34px_rgb(20_30_36_/_0.2)]">
          {!image ? (
            <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
              <div className="relative mb-6 grid h-40 w-40 grid-cols-8 overflow-hidden rounded-xl border border-slate-700 bg-slate-950/35 p-2 opacity-80">
                {Array.from({ length: 64 }, (_, index) => (
                  <span
                    key={index}
                    className={`border border-slate-800/60 ${
                      [18, 19, 20, 21, 26, 29, 34, 37, 42, 43, 44, 45].includes(index)
                        ? "bg-indigo-500/65"
                        : "bg-slate-800/35"
                    }`}
                  />
                ))}
              </div>
              <h2 className="text-xl font-bold text-slate-200">从一张喜欢的图片开始</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                推荐使用主体清楚、背景简单的图片，生成后的颜色边界会更容易辨认。
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-medium text-slate-100 transition-colors hover:border-indigo-500/50 hover:bg-slate-800/80"
              >
                <ImagePlus className="h-4 w-4" strokeWidth={1.8} />
                选择图片
              </button>
            </div>
          ) : processing || !pattern ? (
            <div className="min-h-[560px] p-5" aria-live="polite">
              <div className="mb-4 flex gap-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-16 flex-1 animate-pulse rounded-xl bg-slate-800/65" />
                ))}
              </div>
              <div className="h-[450px] animate-pulse rounded-xl bg-slate-950/35" />
              <span className="sr-only">正在生成拼豆规格图</span>
            </div>
          ) : (
            <div className="p-4 md:p-5">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid flex-1 grid-cols-3 gap-2.5">
                {[
                  { label: "成品尺寸", value: `${pattern.width} x ${pattern.height}` },
                  { label: "拼豆总数", value: pattern.totalBeads.toLocaleString("zh-CN") },
                  { label: "实际用色", value: pattern.palette.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-950/35 px-3 py-3">
                    <p className="font-mono text-base font-bold text-slate-100 md:text-xl">{item.value}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{item.label}</p>
                  </div>
                ))}
                </div>
                <div className="grid shrink-0 grid-cols-2 rounded-xl bg-slate-950/35 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("beads")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      viewMode === "beads" ? "bg-slate-800 text-indigo-400" : "text-slate-500 hover:text-slate-200"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
                    成片预览
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("chart")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      viewMode === "chart" ? "bg-slate-800 text-indigo-400" : "text-slate-500 hover:text-slate-200"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.8} />
                    施工图纸
                  </button>
                </div>
              </div>

              <div className="flex min-h-[420px] items-center justify-center overflow-auto rounded-xl bg-[#dfe5e8] p-4 md:p-6">
                <canvas ref={canvasRef} className="h-auto max-w-full shadow-[0_8px_24px_rgb(36_51_61_/_0.18)]" />
              </div>

              <section className="mt-5">
                <div className="mb-3 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-indigo-400" strokeWidth={1.8} />
                  <h2 className="font-semibold text-slate-100">颜色清单</h2>
                  <span className="text-xs text-slate-500">编号与格内数字一致</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
                  {pattern.palette.map((color) => (
                    <div key={color.code} className="flex min-w-0 items-center gap-2.5 rounded-lg bg-slate-950/35 p-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 font-mono text-[11px] font-bold"
                        style={{ backgroundColor: color.hex, color: color.textColor }}
                      >
                        {Number(color.code.slice(1))}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-mono text-xs font-bold text-slate-200">{color.code}</span>
                        <span className="block truncate font-mono text-[10px] text-slate-500">
                          {color.hex} / {color.count} 颗
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      </div>

      {previewOpen && pattern && image && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bead-preview-title"
          onClick={() => setPreviewOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-4 backdrop-blur-md md:p-8"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-[0_28px_80px_rgb(15_23_28_/_0.5)] md:max-h-[calc(100dvh-4rem)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3 md:px-5">
              <div className="min-w-0">
                <h2 id="bead-preview-title" className="truncate font-semibold text-slate-100">
                  成片预览
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {pattern.width} x {pattern.height} 颗 / {pattern.palette.length} 色
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={downloadFinishedPreview}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-[#172027] transition-colors hover:bg-indigo-400"
                >
                  <ImageDown className="h-4 w-4" strokeWidth={1.8} />
                  下载成片
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="关闭成片预览"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#dfe5e8] p-3 md:p-6">
              <canvas
                ref={previewCanvasRef}
                className="h-auto max-h-[calc(100dvh-150px)] max-w-full shadow-[0_16px_50px_rgb(36_51_61_/_0.24)] [image-rendering:pixelated]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
