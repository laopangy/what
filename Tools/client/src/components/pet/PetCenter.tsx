import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Cat,
  Check,
  ChevronRight,
  Dog,
  EyeOff,
  ImagePlus,
  Leaf,
  LoaderCircle,
  MousePointer2,
  PawPrint,
  Play,
  Rabbit,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { petApi } from "../../api/petApi";
import type { PetAction, PetCatalogEntry, PetOverview, PetSettings } from "../../types/pet";
import CustomPetManager from "./CustomPetCreator";
import CustomPetPreview from "./CustomPetPreview";
import PetPreviewCanvas from "./PetPreviewCanvas";

type Section = "mine" | "square" | "custom" | "ai";

const actions: Array<{ value: PetAction; label: string }> = [
  { value: "idle", label: "待机" },
  { value: "walk", label: "行走" },
  { value: "sleep-enter", label: "入睡" },
  { value: "happy", label: "开心" },
  { value: "curious", label: "好奇" },
  { value: "stretch", label: "伸展" },
  { value: "groom", label: "舔爪" },
  { value: "wake", label: "醒来" },
];

const tabs: Array<{ value: Section; label: string; icon: typeof PawPrint }> = [
  { value: "mine", label: "我的灵宠", icon: PawPrint },
  { value: "square", label: "灵宠广场", icon: Sparkles },
  { value: "custom", label: "自定义", icon: ImagePlus },
  { value: "ai", label: "AI 创作", icon: WandSparkles },
];

export default function PetCenter() {
  const [section, setSection] = useState<Section>("mine");
  const [overview, setOverview] = useState<PetOverview | null>(null);
  const [draft, setDraft] = useState<PetSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [previewAction, setPreviewAction] = useState<PetAction>("idle");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await petApi.getOverview();
      setOverview(next);
      setDraft(next.state.settings);
      dirtyRef.current = false;
      setDirty(false);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "无法加载灵宠中心");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    return petApi.subscribe((state) => {
      setOverview((current) => current ? { ...current, state } : current);
      if (!dirtyRef.current) setDraft(state.settings);
    });
  }, []);

  const currentPet = useMemo(() => overview?.catalog.find((pet) => pet.id === overview.state.settings.activePetId), [overview]);
  const currentCustomPet = useMemo(() => overview?.state.customPets.find((pet) => pet.id === overview.state.settings.activePetId), [overview]);
  const care = overview?.state.care[overview.state.settings.activePetId];

  const updateDraft = <K extends keyof PetSettings>(key: K, value: PetSettings[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    dirtyRef.current = true;
    setDirty(true);
  };

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2_800);
  };

  const saveDraft = async () => {
    if (!draft || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      const result = await petApi.updateSettings(draft);
      setOverview((current) => current ? { ...current, state: result.state } : current);
      setDraft(result.state.settings);
      dirtyRef.current = false;
      setDirty(false);
      flash("设置已加密保存");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const setEnabled = async (enabled: boolean) => {
    setSaving(true);
    try {
      const result = await petApi.updateSettings({ enabled });
      setOverview((current) => current ? { ...current, state: result.state } : current);
      setDraft((current) => current ? { ...current, enabled } : current);
      flash(enabled ? "雾团已出现在工作台" : "灵宠已隐藏");
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "操作失败");
    } finally {
      setSaving(false);
    }
  };

  const activatePet = async (pet: PetCatalogEntry) => {
    if (!pet.available) return;
    setSaving(true);
    try {
      const result = await petApi.updateSettings({ activePetId: pet.id, customName: pet.name, enabled: true });
      setOverview((current) => current ? { ...current, state: result.state } : current);
      setDraft(result.state.settings);
      setSection("mine");
      dirtyRef.current = false;
      setDirty(false);
      flash(`${pet.name}已启用`);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "启用失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PetCenterSkeleton />;

  if (!overview || !draft) {
    return (
      <div className="grid min-h-full place-items-center p-8">
        <div className="w-full max-w-sm rounded-2xl border border-red-200/20 bg-slate-900/72 p-6 text-center shadow-[0_20px_50px_rgb(19_31_39_/.24)]">
          <PawPrint className="mx-auto h-8 w-8 text-red-200/75" strokeWidth={1.5} />
          <h1 className="mt-4 text-lg font-semibold text-slate-100">灵宠中心暂时无法打开</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">{error || "请确认 Tools 服务已经启动并解锁数据仓库。"}</p>
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-400">
            <RefreshCw className="h-4 w-4" />重新连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex flex-col gap-5 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/14 text-indigo-300 ring-1 ring-inset ring-indigo-400/22">
                <PawPrint className="h-5 w-5" strokeWidth={1.65} />
              </span>
              <div>
                <h1 className="text-[1.55rem] font-semibold tracking-[-0.03em] text-slate-50">桌面灵宠</h1>
                <p className="mt-0.5 text-xs text-slate-400">让一个有动作、有性格的伙伴陪你使用工作台。</p>
              </div>
            </div>
          </div>
          <nav className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-900/56 p-1 ring-1 ring-inset ring-white/[0.07]" aria-label="灵宠中心分区">
            {tabs.map((tab) => (
              <button key={tab.value} type="button" onClick={() => setSection(tab.value)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${section === tab.value ? "bg-white/[0.10] text-white shadow-sm" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"}`}>
                <tab.icon className="h-3.5 w-3.5" strokeWidth={1.7} />{tab.label}
              </button>
            ))}
          </nav>
        </header>

        {notice && (
          <div className="fixed right-6 top-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-300/18 bg-[#2b3c3c]/96 px-4 py-3 text-xs text-emerald-100 shadow-xl backdrop-blur-xl">
            <Check className="h-4 w-4 text-emerald-300" />{notice}
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-red-200/18 bg-red-950/16 px-4 py-3 text-xs text-red-100">{error}</div>}

        {section === "mine" && (
          <main className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,.75fr)]">
            <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-slate-900/62 shadow-[0_22px_55px_rgb(23_35_43_/.22)]">
              <div className="grid min-h-[410px] md:grid-cols-[minmax(260px,.92fr)_minmax(280px,1.08fr)]">
                <div className="relative grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgb(99_124_132_/.32),transparent_58%),linear-gradient(145deg,rgb(77_94_104_/.78),rgb(48_61_70_/.88))] p-5">
                  <div className="absolute inset-x-8 bottom-10 h-10 rounded-[50%] bg-slate-950/18 blur-xl" />
                  {currentCustomPet ? (
                    <CustomPetPreview pet={currentCustomPet} action={previewAction} className="relative z-10 h-auto w-full max-w-[290px] drop-shadow-[0_20px_20px_rgb(20_30_37_/.23)]" />
                  ) : (
                    <PetPreviewCanvas petId={draft.activePetId} action={previewAction} className="relative z-10 h-auto w-full max-w-[290px] drop-shadow-[0_20px_20px_rgb(20_30_37_/.23)]" />
                  )}
                  <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-slate-950/26 px-2.5 py-1.5 text-[10px] text-white/64 backdrop-blur-md">
                    实时动作预览
                  </div>
                </div>

                <div className="flex flex-col p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-medium tracking-[0.12em] text-indigo-300">当前伙伴</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{draft.customName}</h2>
                      <p className="mt-2 text-sm text-slate-400">{currentPet?.personality}</p>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-[10px] font-medium ${draft.enabled ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.06] text-slate-400"}`}>
                      {draft.enabled ? "陪伴中" : "已隐藏"}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <Stat label="亲密度" value={care?.affection ?? 0} suffix="/ 100" />
                    <Stat label="心情" value={care?.mood ?? 0} suffix="/ 100" />
                    <Stat label="互动" value={care?.totalInteractions ?? 0} suffix="次" />
                  </div>

                  <div className="mt-6">
                    <p className="mb-2.5 text-[11px] font-medium text-slate-300">预览动作</p>
                    <div className="flex flex-wrap gap-1.5">
                      {actions.map((item) => (
                        <button key={item.value} type="button" onClick={() => setPreviewAction(item.value)} className={`rounded-lg px-2.5 py-1.5 text-[10px] transition ${previewAction === item.value ? "bg-indigo-500 text-slate-950" : "bg-white/[0.055] text-slate-300 hover:bg-white/[0.09]"}`}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2 pt-7">
                    <button type="button" disabled={saving} onClick={() => void setEnabled(!draft.enabled)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-xs font-semibold text-slate-950 transition hover:bg-indigo-400 active:scale-[0.985] disabled:opacity-50">
                      {draft.enabled ? <><EyeOff className="h-4 w-4" />隐藏灵宠</> : <><Play className="h-4 w-4 fill-current" />启用灵宠</>}
                    </button>
                    <button type="button" onClick={() => setSection("square")} className="grid w-11 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white" title="切换灵宠">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.09] bg-slate-900/56 p-5 shadow-[0_18px_42px_rgb(23_35_43_/.18)]">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="h-4 w-4 text-indigo-300" />
                <h2 className="text-sm font-semibold text-slate-100">陪伴设置</h2>
              </div>
              <div className="mt-5 space-y-5">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-medium text-slate-300">灵宠名字</span>
                  <input value={draft.customName} onChange={(event) => updateDraft("customName", event.target.value)} maxLength={24} className="h-10 w-full rounded-xl border border-white/[0.09] bg-slate-950/28 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400/45" />
                </label>
                <RangeControl label="显示大小" value={draft.scale} minimum={0.65} maximum={1.6} step={0.05} display={`${Math.round(draft.scale * 100)}%`} onChange={(value) => updateDraft("scale", value)} />
                <RangeControl label="透明度" value={draft.opacity} minimum={0.45} maximum={1} step={0.05} display={`${Math.round(draft.opacity * 100)}%`} onChange={(value) => updateDraft("opacity", value)} />
                <label className="block">
                  <span className="mb-2 block text-[11px] font-medium text-slate-300">活跃程度</span>
                  <select value={draft.activityLevel} onChange={(event) => updateDraft("activityLevel", event.target.value as PetSettings["activityLevel"])} className="h-10 w-full rounded-xl border border-white/[0.09] bg-slate-950/28 px-3 text-sm text-white outline-none focus:border-indigo-400/45">
                    <option value="quiet">安静</option>
                    <option value="normal">正常</option>
                    <option value="lively">活泼</option>
                  </select>
                </label>
                <Toggle label="自主活动" description="空闲时散步、观察、整理毛发和睡觉" checked={draft.autonomous} onChange={(value) => updateDraft("autonomous", value)} />
                <Toggle label="对话气泡" description="互动或自主行为时偶尔说话" checked={draft.dialogueEnabled} onChange={(value) => updateDraft("dialogueEnabled", value)} />
                <Toggle label="工作台联动" description="响应音乐、定时任务和 AI 请求状态" checked={draft.eventLinkEnabled} onChange={(value) => updateDraft("eventLinkEnabled", value)} />
              </div>
              <button type="button" disabled={!dirty || saving || !draft.customName.trim()} onClick={() => void saveDraft()} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.09] text-xs font-semibold text-white transition hover:bg-white/[0.13] disabled:cursor-not-allowed disabled:opacity-35">
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "正在保存" : dirty ? "保存设置" : "设置已保存"}
              </button>
            </section>

            <section className="lg:col-span-2 grid gap-3 md:grid-cols-3">
              <Capability icon={MousePointer2} title="自然互动" description="单击、双击、悬停、拖动和右键菜单均已可用。" />
              <Capability icon={Sparkles} title="自主行为" description="行为由有限状态机调度，不会让多个动作同时冲突。" />
              <Capability icon={PawPrint} title="加密养成" description="位置、设置、亲密度与心情写入 what.vault。" />
            </section>
          </main>
        )}

        {section === "square" && (
          <main className="mt-6">
            <div className="max-w-xl">
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-white">灵宠广场</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">六个角色均使用独立动作图集、行为权重和互动风格，切换后无需刷新工作台。</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {overview.catalog.map((pet) => (
                <button key={pet.id} type="button" disabled={!pet.available || saving} onClick={() => void activatePet(pet)} className={`group min-h-48 rounded-2xl border p-5 text-left transition ${pet.available ? "border-indigo-300/18 bg-slate-900/62 hover:-translate-y-0.5 hover:border-indigo-300/38 hover:bg-slate-900/78" : "cursor-not-allowed border-white/[0.06] bg-slate-900/36 opacity-68"}`}>
                  <div className="flex items-start justify-between">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ${pet.available ? "bg-indigo-500/14 text-indigo-300" : "bg-white/[0.05] text-slate-500"}`}>
                      <SpeciesIcon species={pet.species} />
                    </span>
                    <span className={`rounded-lg px-2 py-1 text-[10px] ${pet.available ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.05] text-slate-500"}`}>{pet.available ? "可启用" : "动作制作中"}</span>
                  </div>
                  {pet.available && pet.source !== "custom" && <PetPreviewCanvas petId={pet.id} action="idle" className="mx-auto -mb-3 -mt-8 h-28 w-28" />}
                  <h3 className="mt-5 text-base font-semibold text-slate-100">{pet.name}</h3>
                  <p className="mt-1 text-xs text-indigo-200/70">{pet.personality}</p>
                  <p className="mt-3 text-xs leading-5 text-slate-400">{pet.description}</p>
                  <p className="mt-4 text-[10px] text-slate-500">{pet.signatureActions.join(" / ")}</p>
                </button>
              ))}
            </div>
          </main>
        )}

        {section === "custom" && <CustomPetManager pets={overview.state.customPets} onChanged={load} />}

        {section === "ai" && <AiServicesPanel dialogueConfigured={overview.capabilities.aiDialogue} />}
      </div>
    </div>
  );
}

function PetCenterSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] animate-pulse p-7">
      <div className="h-12 w-72 rounded-xl bg-white/[0.06]" />
      <div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="h-[410px] rounded-2xl bg-white/[0.05]" />
        <div className="h-[410px] rounded-2xl bg-white/[0.05]" />
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="rounded-xl bg-white/[0.045] px-3 py-3 ring-1 ring-inset ring-white/[0.055]">
      <p className="text-[9px] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-100">{value}<span className="ml-1 text-[9px] font-normal text-slate-500">{suffix}</span></p>
    </div>
  );
}

function RangeControl({ label, value, minimum, maximum, step, display, onChange }: { label: string; value: number; minimum: number; maximum: number; step: number; display: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-300"><span>{label}</span><span className="text-indigo-300">{display}</span></span>
      <input type="range" value={value} min={minimum} max={maximum} step={step} onChange={(event) => onChange(Number(event.target.value))} className="pet-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-950/38 accent-indigo-500" />
    </label>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-white/[0.035] px-3.5 py-3 ring-1 ring-inset ring-white/[0.05]">
      <span><span className="block text-xs font-medium text-slate-200">{label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{description}</span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span className="relative h-6 w-10 shrink-0 rounded-full bg-slate-950/48 transition peer-checked:bg-indigo-500 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-slate-300 after:transition-transform peer-checked:after:translate-x-4 peer-checked:after:bg-slate-950" />
    </label>
  );
}

function Capability({ icon: Icon, title, description }: { icon: typeof PawPrint; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-900/42 p-4">
      <Icon className="h-4 w-4 text-indigo-300" strokeWidth={1.6} />
      <h3 className="mt-3 text-xs font-semibold text-slate-200">{title}</h3>
      <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function SpeciesIcon({ species }: { species: PetCatalogEntry["species"] }) {
  const Icon = species === "cat" ? Cat : species === "dog" ? Dog : species === "rabbit" ? Rabbit : species === "robot" ? Bot : species === "red-panda" ? Leaf : Sparkles;
  return <Icon className="h-5 w-5" strokeWidth={1.6} />;
}

function AiServicesPanel({ dialogueConfigured }: { dialogueConfigured: boolean }) {
  return (
    <main className="mt-6 rounded-2xl border border-white/[0.08] bg-slate-900/42 p-6 lg:p-8">
      <div className="max-w-xl">
        <p className="text-[10px] font-medium tracking-[0.12em] text-indigo-300">服务接入状态</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-white">AI 能力</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">所有请求均由后端发起，服务密钥不会发送到浏览器。未接通的能力不会返回伪造结果。</p>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-5">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/13 text-indigo-300"><Bot className="h-5 w-5" strokeWidth={1.6} /></span>
            <span className={`rounded-lg px-2.5 py-1 text-[10px] font-medium ${dialogueConfigured ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-300/10 text-amber-200"}`}>{dialogueConfigured ? "已配置" : "未配置"}</span>
          </div>
          <h3 className="mt-5 text-sm font-semibold text-slate-100">灵宠文本对话</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">{dialogueConfigured ? "已读取 DeepSeek 文本服务配置。右键工作台灵宠并选择“和我说说话”即可发起真实请求。" : "请先在账号与服务设置中配置 AI Key，之后可从灵宠右键菜单发起真实对话。"}</p>
        </section>
        <section className="rounded-2xl border border-white/[0.08] bg-slate-950/20 p-5">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.055] text-slate-400"><WandSparkles className="h-5 w-5" strokeWidth={1.6} /></span>
            <span className="rounded-lg bg-white/[0.055] px-2.5 py-1 text-[10px] font-medium text-slate-500">未接通</span>
          </div>
          <h3 className="mt-5 text-sm font-semibold text-slate-100">文生图与动作生成</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">现有 DeepSeek 配置不提供图像生成。接入独立图像服务、真实任务状态与失败重试后才会开放。</p>
        </section>
      </div>
    </main>
  );
}
