import { useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { Check, Crop, ImagePlus, Layers3, LoaderCircle, Pencil, Save, Sparkles, Trash2, Upload, WandSparkles } from "lucide-react";
import { petApi, type CustomPetPayload } from "../../api/petApi";
import type { CustomPetAssetInput, CustomPetMode, CustomPetSummary } from "../../types/pet";

const STATIC_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ANIMATED_TYPES = new Set(["image/gif", "image/webp"]);
const MAX_INPUT_SIZE = 20 * 1024 * 1024;

type SourceImage = {
  name: string;
  mimeType: string;
  url: string;
  image: HTMLImageElement;
  file?: File;
};

type CropOptions = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  removeBackground: boolean;
  background: [number, number, number];
  tolerance: number;
};

export default function CustomPetManager({ pets, onChanged }: { pets: CustomPetSummary[]; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState<CustomPetSummary | null>(null);
  const [creating, setCreating] = useState(pets.length === 0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CustomPetSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removePet = async (pet: CustomPetSummary) => {
    setDeleting(pet.id);
    setPendingDelete(null);
    setError(null);
    try {
      await petApi.deleteCustom(pet.id);
      if (editing?.id === pet.id) setEditing(null);
      await onChanged();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <main className="mt-6 space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-slate-900/52 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">自定义灵宠</h2>
          <p className="mt-1.5 text-xs leading-5 text-slate-400">上传图片并裁剪主体，或直接导入 GIF、WebP 动画、Sprite Sheet 与 PNG 序列。</p>
        </div>
        <button type="button" onClick={() => { setEditing(null); setCreating(true); }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400">
          <ImagePlus className="h-4 w-4" />创建灵宠
        </button>
      </section>

      {error && <div className="rounded-xl border border-red-200/18 bg-red-950/16 px-4 py-3 text-xs text-red-100">{error}</div>}

      {pets.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {pets.map((pet) => (
            <article key={pet.id} className="rounded-2xl border border-white/[0.08] bg-slate-900/46 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{pet.name}</h3>
                  <p className="mt-1 text-[10px] text-indigo-300">{pet.asset.mode === "sprite" ? "Sprite 动作" : pet.asset.mode === "animated-image" ? "原始动画" : "基础动态"}</p>
                </div>
                <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-[9px] text-slate-500">{pet.asset.width} × {pet.asset.height}</span>
              </div>
              <p className="mt-3 min-h-10 text-[11px] leading-5 text-slate-400">{pet.description || "由图片创建的专属伙伴"}</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => { setEditing(pet); setCreating(true); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[10px] text-slate-200 transition hover:bg-white/[0.1]"><Pencil className="h-3.5 w-3.5" />编辑</button>
                <button type="button" disabled={deleting === pet.id} onClick={() => setPendingDelete(pet)} className="grid w-9 place-items-center rounded-lg bg-red-300/[0.06] text-red-200/70 transition hover:bg-red-300/[0.1] hover:text-red-100 disabled:opacity-40" title="删除"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </article>
          ))}
        </section>
      )}

      {creating && (
        <CustomPetEditor
          key={editing?.id ?? "new"}
          editing={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await onChanged();
          }}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/72 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="确认删除灵宠">
          <section className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#222f38] p-5 shadow-[0_24px_70px_rgb(10_18_24_/.55)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-300/10 text-red-200"><Trash2 className="h-4.5 w-4.5" /></span>
            <h3 className="mt-4 text-base font-semibold text-white">删除“{pendingDelete.name}”？</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">相关图片与养成数据会从加密仓库永久移除；如果它正在使用，将自动切回雾团。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/[0.1]">取消</button>
              <button type="button" onClick={() => void removePet(pendingDelete)} className="rounded-xl bg-red-300 px-4 py-2.5 text-xs font-semibold text-red-950 transition hover:bg-red-200 active:scale-[0.98]">确认删除</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function CustomPetEditor({ editing, onCancel, onSaved }: { editing: CustomPetSummary | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [mode, setMode] = useState<CustomPetMode>(editing?.asset.mode ?? "static");
  const [name, setName] = useState(editing?.name ?? "");
  const [personality, setPersonality] = useState(editing?.personality ?? "温柔、亲近");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [background, setBackground] = useState<[number, number, number]>([255, 255, 255]);
  const [tolerance, setTolerance] = useState(32);
  const [columns, setColumns] = useState(editing?.asset.animation?.columns ?? 6);
  const [rows, setRows] = useState(editing?.asset.animation?.rows ?? 4);
  const [fps, setFps] = useState(editing?.asset.animation?.fps ?? 8);
  const [actionRows, setActionRows] = useState(editing?.asset.animation?.actionRows ?? true);
  const [saving, setSaving] = useState(false);
  const [loadingAsset, setLoadingAsset] = useState(Boolean(editing));
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    petApi.getCustomAsset(editing.id)
      .then(async ({ asset }) => {
        if (cancelled) return;
        const urls = [asset.imageDataUrl, ...asset.referenceDataUrls];
        const loaded = await Promise.all(urls.map(async (url, index) => ({
          name: index === 0 ? editing.name : `${editing.name} 参考图 ${index}`,
          mimeType: asset.mimeType,
          url,
          image: await loadImage(url),
        })));
        if (cancelled) return;
        setSources(loaded);
      })
      .catch((assetError: unknown) => setError(assetError instanceof Error ? assetError.message : "资源加载失败"))
      .finally(() => setLoadingAsset(false));
    return () => { cancelled = true; };
  }, [editing]);

  const selectedSource = sources[selected];
  const options = useMemo<CropOptions>(() => ({ zoom, offsetX, offsetY, removeBackground, background, tolerance }), [background, offsetX, offsetY, removeBackground, tolerance, zoom]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !selectedSource || mode !== "static") return;
    renderCropped(selectedSource.image, 512, options, canvas);
  }, [mode, options, selectedSource]);

  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    setError(null);
    if (files.length === 0) return;
    const allowed = mode === "animated-image" ? ANIMATED_TYPES : STATIC_TYPES;
    const limit = mode === "static" ? 4 : mode === "sprite" ? 24 : 1;
    if (files.length > limit) {
      setError(`当前模式最多选择 ${limit} 个文件`);
      return;
    }
    if (files.some((file) => !allowed.has(file.type))) {
      setError(mode === "animated-image" ? "动画图片仅支持 GIF 或 WebP" : "请选择 PNG、JPG 或 WebP 图片");
      return;
    }
    if (files.some((file) => file.size > MAX_INPUT_SIZE)) {
      setError("单个文件不能超过 20 MB");
      return;
    }
    try {
      const next = await Promise.all(files.map(async (file) => {
        const url = URL.createObjectURL(file);
        objectUrlsRef.current.push(url);
        return { name: file.name, mimeType: file.type, url, image: await loadImage(url), file } satisfies SourceImage;
      }));
      setSources(next);
      setSelected(0);
      const first = next[0].image;
      setBackground(sampleCorners(first));
      if (mode === "sprite" && next.length > 1) {
        const nextColumns = Math.min(12, Math.ceil(Math.sqrt(next.length)));
        setColumns(nextColumns);
        setRows(Math.ceil(next.length / nextColumns));
        setActionRows(false);
      }
    } catch {
      setError("无法读取其中一张图片，请更换文件重试");
    }
  };

  const pickBackground = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - bounds.left) / bounds.width * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - bounds.top) / bounds.height * canvas.height)));
    const pixel = canvas.getContext("2d")?.getImageData(x, y, 1, 1).data;
    if (pixel && pixel[3] > 0) {
      setBackground([pixel[0], pixel[1], pixel[2]]);
      setRemoveBackground(true);
    }
  };

  const save = async () => {
    if (!name.trim() || !personality.trim() || sources.length === 0) {
      setError("请填写名称、性格并选择图片");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const asset = await buildAsset(mode, sources, selected, options, { columns, rows, fps, actionRows });
      const payload: CustomPetPayload = {
        name: name.trim(),
        personality: personality.trim(),
        description: description.trim(),
        asset,
      };
      if (editing) await petApi.updateCustom(editing.id, payload);
      else await petApi.createCustom(payload);
      await onSaved();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-slate-900/58 shadow-[0_22px_55px_rgb(23_35_43_/.2)]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div><h3 className="text-sm font-semibold text-slate-100">{editing ? "编辑自定义灵宠" : "创建自定义灵宠"}</h3><p className="mt-1 text-[10px] text-slate-500">所有保存资源都会加密写入 what.vault</p></div>
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[10px] text-slate-400 transition hover:bg-white/[0.06] hover:text-white">取消</button>
      </div>

      <div className="grid lg:grid-cols-[minmax(320px,.9fr)_minmax(360px,1.1fr)]">
        <div className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-3 gap-2">
            <ModeButton active={mode === "static"} icon={Crop} label="图片主体" onClick={() => { setMode("static"); setSources([]); }} />
            <ModeButton active={mode === "animated-image"} icon={Sparkles} label="GIF / WebP" onClick={() => { setMode("animated-image"); setSources([]); }} />
            <ModeButton active={mode === "sprite"} icon={Layers3} label="动作素材" onClick={() => { setMode("sprite"); setSources([]); }} />
          </div>

          <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-300/24 bg-indigo-500/[0.045] px-4 text-center transition hover:border-indigo-300/42 hover:bg-indigo-500/[0.07]">
            {loadingAsset ? <LoaderCircle className="h-5 w-5 animate-spin text-indigo-300" /> : <Upload className="h-5 w-5 text-indigo-300" />}
            <span className="mt-2 text-xs font-medium text-slate-200">{sources.length ? "替换图片" : mode === "sprite" ? "选择 Sprite Sheet 或 PNG 序列" : "选择图片"}</span>
            <span className="mt-1 text-[9px] text-slate-500">{mode === "static" ? "最多 4 张不同角度" : mode === "sprite" ? "单张图集或最多 24 帧序列" : "保留原始动画"}</span>
            <input type="file" multiple={mode !== "animated-image"} accept={mode === "animated-image" ? "image/gif,image/webp" : "image/png,image/jpeg,image/webp"} onChange={(event) => void chooseFiles(event)} className="sr-only" />
          </label>

          {sources.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {sources.map((source, index) => (
                <button key={`${source.name}-${index}`} type="button" onClick={() => { setSelected(index); setBackground(sampleCorners(source.image)); }} className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border ${selected === index ? "border-indigo-300/70" : "border-white/[0.08]"}`}>
                  <img src={source.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="relative mt-4 aspect-square overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_42%,rgb(108_134_143_/.28),transparent_60%),rgb(47_60_69_/.72)] ring-1 ring-inset ring-white/[0.08]">
            {!selectedSource ? (
              <div className="grid h-full place-items-center text-center text-[10px] leading-5 text-slate-500">选择图片后在这里确认主体</div>
            ) : mode === "static" ? (
              <canvas ref={previewRef} onClick={pickBackground} className="h-full w-full cursor-crosshair object-contain" title="点击选择要去除的背景颜色" />
            ) : (
              <img src={selectedSource.url} alt="素材预览" className="h-full w-full object-contain" />
            )}
          </div>

          {mode === "static" && selectedSource && (
            <div className="mt-4 space-y-4">
              <Range label="缩放" value={zoom} min={1} max={3} step={0.05} display={`${Math.round(zoom * 100)}%`} onChange={setZoom} />
              <Range label="水平位置" value={offsetX} min={-1} max={1} step={0.02} display={`${Math.round(offsetX * 100)}`} onChange={setOffsetX} />
              <Range label="垂直位置" value={offsetY} min={-1} max={1} step={0.02} display={`${Math.round(offsetY * 100)}`} onChange={setOffsetY} />
              <label className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-3 ring-1 ring-inset ring-white/[0.05]">
                <span><span className="block text-[11px] font-medium text-slate-200">边缘颜色去背景</span><span className="mt-1 block text-[9px] text-slate-500">点击预览可手动选择背景色</span></span>
                <input type="checkbox" checked={removeBackground} onChange={(event) => setRemoveBackground(event.target.checked)} className="h-4 w-4 accent-indigo-500" />
              </label>
              {removeBackground && <Range label="去背景容差" value={tolerance} min={8} max={96} step={2} display={String(tolerance)} onChange={setTolerance} />}
            </div>
          )}

          {mode === "sprite" && selectedSource && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <NumberField label="列数" value={columns} min={1} max={12} onChange={setColumns} disabled={sources.length > 1} />
              <NumberField label="行数" value={rows} min={1} max={12} onChange={setRows} disabled={sources.length > 1} />
              <NumberField label="帧率" value={fps} min={1} max={30} onChange={setFps} />
              <label className="sm:col-span-3 flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-3 ring-1 ring-inset ring-white/[0.05]">
                <span><span className="block text-[11px] font-medium text-slate-200">动作分行</span><span className="mt-1 block text-[9px] text-slate-500">前四行依次作为待机、移动、睡眠、互动</span></span>
                <input type="checkbox" checked={actionRows} disabled={rows < 4 || sources.length > 1} onChange={(event) => setActionRows(event.target.checked)} className="h-4 w-4 accent-indigo-500 disabled:opacity-35" />
              </label>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-[11px] font-medium text-slate-300">灵宠名称</span><input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="例如：小雪" className="h-10 w-full rounded-xl border border-white/[0.09] bg-slate-950/28 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/45" /></label>
            <label className="block"><span className="mb-2 block text-[11px] font-medium text-slate-300">性格描述</span><input value={personality} maxLength={120} onChange={(event) => setPersonality(event.target.value)} placeholder="温柔、好奇" className="h-10 w-full rounded-xl border border-white/[0.09] bg-slate-950/28 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/45" /></label>
          </div>
          <label className="mt-4 block"><span className="mb-2 block text-[11px] font-medium text-slate-300">角色介绍</span><textarea value={description} maxLength={240} onChange={(event) => setDescription(event.target.value)} placeholder="写一句这个伙伴的特点" className="min-h-24 w-full resize-none rounded-xl border border-white/[0.09] bg-slate-950/28 px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/45" /></label>

          <div className="mt-5 rounded-xl bg-indigo-500/[0.055] p-4 ring-1 ring-inset ring-indigo-300/12">
            <div className="flex items-center gap-2 text-[11px] font-medium text-indigo-200"><WandSparkles className="h-4 w-4" />当前生成方式</div>
            <p className="mt-2 text-[10px] leading-5 text-slate-400">
              {mode === "static" ? "静态图片会生成透明或保留背景的 512px 角色资源，并使用明确标注的基础呼吸、好奇和跳跃微动画。" : mode === "animated-image" ? "GIF 或动画 WebP 会保留原始动画，不会伪造额外动作。" : "Sprite Sheet 会按真实分帧播放；PNG 序列会在本地打包为图集后加密保存。"}
            </p>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200/18 bg-red-950/16 px-4 py-3 text-[11px] text-red-100">{error}</div>}

          <button type="button" disabled={saving || loadingAsset || !sources.length || !name.trim() || !personality.trim()} onClick={() => void save()} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-35">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {saving ? "正在加密保存" : editing ? "保存修改" : "创建灵宠"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Crop; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] transition ${active ? "bg-indigo-500 text-slate-950" : "bg-white/[0.045] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"}`}><Icon className="h-3.5 w-3.5" />{label}</button>;
}

function Range({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between text-[10px] text-slate-400"><span>{label}</span><span className="text-indigo-300">{display}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-950/38 accent-indigo-500" /></label>;
}

function NumberField({ label, value, min, max, onChange, disabled = false }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="block"><span className="mb-2 block text-[10px] text-slate-400">{label}</span><input type="number" value={value} min={min} max={max} disabled={disabled} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="h-9 w-full rounded-lg border border-white/[0.08] bg-slate-950/26 px-2 text-xs text-white outline-none focus:border-indigo-400/45 disabled:opacity-35" /></label>;
}

async function buildAsset(mode: CustomPetMode, sources: SourceImage[], selected: number, options: CropOptions, animation: { columns: number; rows: number; fps: number; actionRows: boolean }): Promise<CustomPetAssetInput> {
  if (mode === "animated-image") {
    const source = sources[0];
    if (source.file && source.file.size > 6 * 1024 * 1024) throw new Error("动画图片加密后不能超过 6 MB");
    return {
      mode,
      mimeType: source.mimeType as CustomPetAssetInput["mimeType"],
      imageDataUrl: source.file ? await readFileDataUrl(source.file) : source.url,
      referenceDataUrls: [],
      width: source.image.naturalWidth,
      height: source.image.naturalHeight,
      backgroundRemoved: false,
    };
  }

  if (mode === "sprite") {
    const atlas = sources.length > 1
      ? packSequence(sources, animation.columns)
      : fitWholeImage(sources[0].image, 4096);
    return {
      mode,
      mimeType: "image/webp",
      imageDataUrl: atlas.canvas.toDataURL("image/webp", 0.9),
      referenceDataUrls: [],
      width: atlas.canvas.width,
      height: atlas.canvas.height,
      backgroundRemoved: false,
      animation: {
        columns: atlas.columns ?? animation.columns,
        rows: atlas.rows ?? animation.rows,
        fps: animation.fps,
        actionRows: sources.length > 1 ? false : animation.actionRows,
        frameCount: sources.length > 1 ? sources.length : undefined,
      },
    };
  }

  const primary = renderCropped(sources[selected].image, 512, options);
  const mimeType: CustomPetAssetInput["mimeType"] = options.removeBackground ? "image/png" : "image/webp";
  const references = sources
    .filter((_, index) => index !== selected)
    .slice(0, 3)
    .map((source) => renderCropped(source.image, 256, { ...options, zoom: 1, offsetX: 0, offsetY: 0 }).toDataURL(mimeType, 0.86));
  return {
    mode,
    mimeType,
    imageDataUrl: primary.toDataURL(mimeType, 0.88),
    referenceDataUrls: references,
    width: primary.width,
    height: primary.height,
    backgroundRemoved: options.removeBackground,
  };
}

function renderCropped(image: HTMLImageElement, size: number, options: CropOptions, target?: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = target ?? document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: options.removeBackground });
  if (!context) throw new Error("浏览器不支持图片处理");
  context.clearRect(0, 0, size, size);
  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * options.zoom;
  const width = image.naturalWidth * baseScale;
  const height = image.naturalHeight * baseScale;
  const x = (size - width) / 2 + options.offsetX * size * 0.35;
  const y = (size - height) / 2 + options.offsetY * size * 0.35;
  context.drawImage(image, x, y, width, height);
  if (options.removeBackground) removeConnectedBackground(context, size, size, options.background, options.tolerance);
  return canvas;
}

function removeConnectedBackground(context: CanvasRenderingContext2D, width: number, height: number, target: [number, number, number], tolerance: number): void {
  const image = context.getImageData(0, 0, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let start = 0;
  let end = 0;
  const canRemove = (pixel: number) => {
    const index = pixel * 4;
    const dr = image.data[index] - target[0];
    const dg = image.data[index + 1] - target[1];
    const db = image.data[index + 2] - target[2];
    return image.data[index + 3] === 0 || Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance;
  };
  const enqueue = (pixel: number) => {
    if (visited[pixel] || !canRemove(pixel)) return;
    visited[pixel] = 1;
    queue[end++] = pixel;
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (start < end) {
    const pixel = queue[start++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }
  for (let pixel = 0; pixel < visited.length; pixel++) if (visited[pixel]) image.data[pixel * 4 + 3] = 0;
  context.putImageData(image, 0, 0);
}

function fitWholeImage(image: HTMLImageElement, maxDimension: number): { canvas: HTMLCanvasElement; columns?: number; rows?: number } {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas };
}

function packSequence(sources: SourceImage[], requestedColumns: number): { canvas: HTMLCanvasElement; columns: number; rows: number } {
  const columns = Math.min(12, Math.max(1, Math.min(requestedColumns, sources.length)));
  const rows = Math.ceil(sources.length / columns);
  const frameSize = Math.min(512, Math.floor(4096 / Math.max(columns, rows)));
  const canvas = document.createElement("canvas");
  canvas.width = columns * frameSize;
  canvas.height = rows * frameSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持序列帧打包");
  sources.forEach((source, index) => {
    const scale = Math.min(frameSize / source.image.naturalWidth, frameSize / source.image.naturalHeight);
    const width = source.image.naturalWidth * scale;
    const height = source.image.naturalHeight * scale;
    const x = (index % columns) * frameSize + (frameSize - width) / 2;
    const y = Math.floor(index / columns) * frameSize + (frameSize - height) / 2;
    context.drawImage(source.image, x, y, width, height);
  });
  return { canvas, columns, rows };
}

function sampleCorners(image: HTMLImageElement): [number, number, number] {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [255, 255, 255];
  context.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
  context.drawImage(image, image.naturalWidth - 1, 0, 1, 1, 1, 0, 1, 1);
  context.drawImage(image, 0, image.naturalHeight - 1, 1, 1, 0, 1, 1, 1);
  context.drawImage(image, image.naturalWidth - 1, image.naturalHeight - 1, 1, 1, 1, 1, 1, 1);
  const pixels = context.getImageData(0, 0, 2, 2).data;
  const total = [0, 0, 0];
  for (let index = 0; index < 16; index += 4) {
    total[0] += pixels[index];
    total[1] += pixels[index + 1];
    total[2] += pixels[index + 2];
  }
  return [Math.round(total[0] / 4), Math.round(total[1] / 4), Math.round(total[2] / 4)];
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
