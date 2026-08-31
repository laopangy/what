import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bike, Bookmark, CalendarDays, CarFront, ChevronRight, Clock3, CloudSun, Compass,
  Flag, Footprints, Image as ImageIcon, LoaderCircle, LockKeyhole, Map, MapPin, Mic, MicOff,
  Navigation, RefreshCw, Route, Save, Sparkles, TrainFront, Trash2, Utensils, X,
} from "lucide-react";
import { api } from "./api";
import type { Itinerary, ItineraryStop, TransportMode, TripIntent } from "./types";

interface SpeechRecognitionEventLike { results: ArrayLike<{ 0: { transcript: string } }> }
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const defaultQuery = "周六从上海出发去莫干山，一天来回，单程两小时以内，自驾或者高铁都行，不想太累";
const modeMeta: Record<TransportMode, { label: string; icon: typeof CarFront }> = {
  driving: { label: "自驾", icon: CarFront }, rail: { label: "高铁", icon: TrainFront }, cycling: { label: "骑行", icon: Bike },
};

const stopIcon = (stop: ItineraryStop) => {
  if (stop.type === "meal") return Utensils;
  if (stop.type === "activity") return Footprints;
  if (stop.type === "rest") return ImageIcon;
  if (stop.type === "return") return Flag;
  if (stop.type === "station") return TrainFront;
  if (stop.type === "parking") return CarFront;
  return Navigation;
};

function RouteMap({ plan, selectedStop, onSelect }: { plan: Itinerary; selectedStop: number; onSelect: (order: number) => void }) {
  const points = plan.stops.map((stop) => `${stop.mapX},${stop.mapY}`).join(" ");
  return (
    <section className="outdoor-map" aria-label="完整行程路线图">
      <div className="outdoor-map-toolbar">
        <span><CloudSun size={14} /> 16°C · 多云</span>
        <span className="outdoor-data-status"><span />{plan.dataQuality === "live" ? "实时路线" : "路线估算"}</span>
      </div>
      <div className="outdoor-map-label outdoor-map-label-home">上海市</div>
      <div className="outdoor-map-label outdoor-map-label-destination">{plan.intent.destination}</div>
      <svg className="outdoor-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${plan.title}闭环路线`}>
        <defs>
          <filter id="route-glow"><feGaussianBlur stdDeviation="1.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <polyline className="outdoor-route-shadow" points={points} />
        <polyline className="outdoor-route-line" points={points} filter="url(#route-glow)" />
      </svg>
      {plan.stops.map((stop) => {
        const Icon = stopIcon(stop);
        return (
          <button key={stop.id} type="button" className={`outdoor-map-stop ${selectedStop === stop.order ? "is-active" : ""}`} style={{ left: `${stop.mapX}%`, top: `${stop.mapY}%` }} onClick={() => onSelect(stop.order)}>
            <span className="outdoor-map-pin"><Icon size={13} strokeWidth={1.8} /></span>
            <span className="outdoor-map-stop-copy"><b>{stop.order}</b>{stop.title}</span>
          </button>
        );
      })}
      <div className="outdoor-map-scale"><span />20 km</div>
    </section>
  );
}

function Timeline({ plan, selectedStop, onSelect }: { plan: Itinerary; selectedStop: number; onSelect: (order: number) => void }) {
  return (
    <section className="outdoor-timeline" aria-label="行程时间轴">
      {plan.stops.map((stop, index) => {
        const Icon = stopIcon(stop);
        return (
          <article key={stop.id} className={`outdoor-timeline-item ${selectedStop === stop.order ? "is-active" : ""}`}>
            {index > 0 && <div className="outdoor-travel-segment"><span>{stop.travelMinutesFromPrevious || plan.totalTravelMinutes / 2} 分钟</span></div>}
            <button type="button" onClick={() => onSelect(stop.order)}>
              <span className="outdoor-timeline-dot"><Icon size={13} /></span>
              <span><b>{stop.arrivalAt}</b><small>{stop.title}</small></span>
            </button>
          </article>
        );
      })}
    </section>
  );
}

function EditableIntent({ plan, onChange }: { plan: Itinerary; onChange: (next: Partial<TripIntent>) => void }) {
  const intensityLabel = plan.intent.intensity === "relaxed" ? "轻松游" : plan.intent.intensity === "challenging" ? "挑战模式" : "标准强度";
  return (
    <div className="outdoor-intent-list">
      <label><MapPin size={15} /><span><small>出发地</small><input value={plan.intent.origin} onChange={(event) => onChange({ origin: event.target.value })} /></span></label>
      <label><Navigation size={15} /><span><small>目的地</small><input value={plan.intent.destination} onChange={(event) => onChange({ destination: event.target.value })} /></span></label>
      <label><CalendarDays size={15} /><span><small>日期与时间</small><input value={`${plan.intent.dayLabel} ${plan.intent.startTime}—${plan.intent.endTime}`} readOnly /></span></label>
      <label><Clock3 size={15} /><span><small>单程上限</small><input value={`${plan.intent.maxOneWayMinutes} 分钟`} readOnly /></span></label>
      <label><Compass size={15} /><span><small>游玩强度</small><input value={intensityLabel} readOnly /></span></label>
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState(defaultQuery);
  const [plan, setPlan] = useState<Itinerary | null>(null);
  const [savedPlans, setSavedPlans] = useState<Itinerary[]>([]);
  const [view, setView] = useState<"planner" | "saved">("planner");
  const [selectedStop, setSelectedStop] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const generate = async (mode?: TransportMode, overrides?: Partial<TripIntent>) => {
    setLoading(true); setError("");
    try {
      const next = await api.generate(query, mode, overrides);
      const lockedStops = plan?.stops.filter((stop) => stop.locked) || [];
      if (lockedStops.length) {
        next.stops = next.stops.map((stop) => lockedStops.find((locked) => locked.order === stop.order) || stop);
      }
      setPlan(next); setSelectedStop(3); setView("planner");
    } catch (generateError) { setError(generateError instanceof Error ? generateError.message : "暂时无法生成行程"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void generate(); }, []);
  useEffect(() => { api.plans().then(setSavedPlans).catch(() => undefined); }, []);

  const startVoice = () => {
    const scope = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) { setError("当前环境不支持语音识别，请使用文字输入"); return; }
    const recognition = new Recognition();
    recognition.lang = "zh-CN"; recognition.continuous = false; recognition.interimResults = false;
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript; if (transcript) setQuery(transcript); };
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setError("没有听清，请再说一次"); };
    setListening(true); recognition.start();
  };

  const saveCurrent = async () => {
    if (!plan) return;
    setSaving(true); setError("");
    try {
      const saved = await api.save(plan); setPlan(saved);
      setSavedPlans((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const removePlan = async (id: string) => {
    try { await api.remove(id); setSavedPlans((items) => items.filter((item) => item.id !== id)); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : "删除失败"); }
  };

  const selected = useMemo(() => plan?.stops.find((stop) => stop.order === selectedStop), [plan, selectedStop]);
  const toggleSelectedLock = () => {
    if (!plan) return;
    setPlan({ ...plan, stops: plan.stops.map((stop) => stop.order === selectedStop ? { ...stop, locked: !stop.locked } : stop) });
  };

  return (
    <main className="outdoor-root">
      <header className="outdoor-local-header">
        <div><span className="outdoor-eyebrow">OUTDOOR</span><h1>户外</h1><p>一句话生成从出发到回家的完整路线</p></div>
        <nav aria-label="户外模块导航">
          <button className={view === "planner" ? "is-active" : ""} onClick={() => setView("planner")}><Route size={15} />行程规划</button>
          <button className={view === "saved" ? "is-active" : ""} onClick={() => setView("saved")}><Bookmark size={15} />我的计划 <span>{savedPlans.length}</span></button>
        </nav>
      </header>

      {view === "saved" ? (
        <section className="outdoor-saved-view">
          <div className="outdoor-section-heading"><div><span>已保存</span><h2>随时再次出发</h2></div><button className="outdoor-secondary" onClick={() => setView("planner")}><ChevronRight size={15} />规划新行程</button></div>
          {savedPlans.length === 0 ? <div className="outdoor-empty"><Bookmark size={28} /><h3>还没有保存的行程</h3><p>生成完整路线后点击“保存行程”，它会加密写入个人数据仓库。</p></div> : (
            <div className="outdoor-saved-list">{savedPlans.map((item) => <article key={item.id}><div className="outdoor-saved-photo" style={{ backgroundImage: `url(${item.photos[0]?.url})` }} /><div><span>{item.intent.dayLabel} · {modeMeta[item.transportMode].label}</span><h3>{item.title}</h3><p>{item.stops.length} 个节点 · {item.totalDistanceKm} km · 预计 ¥{item.estimatedCost}</p></div><button onClick={() => { setPlan(item); setQuery(item.intent.query); setView("planner"); }}><Map size={16} />查看路线</button><button className="outdoor-icon-button danger" aria-label="删除行程" onClick={() => void removePlan(item.id)}><Trash2 size={15} /></button></article>)}</div>
          )}
        </section>
      ) : (
        <div className="outdoor-workspace">
          <aside className="outdoor-planner-panel">
            <div className="outdoor-prompt-block">
              <label htmlFor="trip-query"><Sparkles size={14} />告诉我你想怎么出去</label>
              <textarea id="trip-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：周六想去看山，自驾两小时以内，一天来回" />
              <div className="outdoor-prompt-actions">
                <button className={`outdoor-voice ${listening ? "is-listening" : ""}`} type="button" onClick={startVoice}>{listening ? <MicOff size={15} /> : <Mic size={15} />}{listening ? "正在听" : "说出想法"}</button>
                <button className="outdoor-generate" type="button" disabled={loading || query.trim().length < 2} onClick={() => void generate()}>{loading ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}生成完整行程</button>
              </div>
            </div>
            {error && <div className="outdoor-error"><AlertTriangle size={15} /><span>{error}</span><button onClick={() => setError("")} aria-label="关闭"><X size={14} /></button></div>}
            {plan && <>
              <div className="outdoor-plan-heading"><div><span>完整行程</span><h2>{plan.title}</h2></div><span className="outdoor-quality">{plan.dataQuality === "live" ? "实时" : "估算"}</span></div>
              <EditableIntent plan={plan} onChange={(overrides) => setPlan({ ...plan, intent: { ...plan.intent, ...overrides } })} />
              <div className="outdoor-mode-switch">{plan.intent.transportModes.map((mode) => { const MetaIcon = modeMeta[mode].icon; return <button key={mode} className={plan.transportMode === mode ? "is-active" : ""} onClick={() => void generate(mode, plan.intent)}><MetaIcon size={15} />{modeMeta[mode].label}</button>; })}</div>
              <dl className="outdoor-summary"><div><dt>总路程</dt><dd>{plan.totalDistanceKm}<small> km</small></dd></div><div><dt>交通时间</dt><dd>{Math.floor(plan.totalTravelMinutes / 60)}<small>h</small> {plan.totalTravelMinutes % 60}<small>m</small></dd></div><div><dt>预计费用</dt><dd><small>¥</small>{plan.estimatedCost}</dd></div></dl>
              <div className="outdoor-panel-footer"><button className="outdoor-secondary" onClick={() => void generate(plan.transportMode, plan.intent)}><RefreshCw size={15} />重新生成</button><button className="outdoor-save" onClick={() => void saveCurrent()} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : plan.saved ? <LockKeyhole size={15} /> : <Save size={15} />}{plan.saved ? "已保存" : "保存行程"}</button></div>
            </>}
          </aside>

          <section className="outdoor-result-panel">
            {loading && !plan ? <div className="outdoor-loading"><div className="outdoor-loading-map" /><div className="outdoor-loading-line" /><p>正在安排路线与返程时间</p></div> : plan && <>
              <RouteMap plan={plan} selectedStop={selectedStop} onSelect={setSelectedStop} />
              <Timeline plan={plan} selectedStop={selectedStop} onSelect={setSelectedStop} />
              <section className="outdoor-photo-story" aria-label="行程图片参考">
                {plan.stops.filter((stop) => stop.photo).map((stop) => <button key={stop.id} type="button" className={selectedStop === stop.order ? "is-active" : ""} onClick={() => setSelectedStop(stop.order)}><img src={stop.photo!.url} alt={stop.photo!.alt} onError={(event) => { event.currentTarget.style.display = "none"; }} /><span><b>{stop.order}</b><strong>{stop.title}</strong><small>{stop.arrivalAt} · {stop.photo!.source}</small></span></button>)}
              </section>
              {selected && <div className="outdoor-selected-detail"><span className="outdoor-selected-order">{selected.order}</span><div><small>{selected.arrivalAt}—{selected.departureAt}</small><strong>{selected.title}</strong><p>{selected.subtitle} · 停留 {selected.stayMinutes} 分钟</p></div><button className={selected.locked ? "is-locked" : ""} title={selected.locked ? "取消锁定" : "锁定节点"} onClick={toggleSelectedLock}><LockKeyhole size={15} />{selected.locked ? "已锁定" : "锁定此站"}</button></div>}
              <footer className="outdoor-route-note"><AlertTriangle size={13} /><span>{plan.warnings[0]}</span></footer>
            </>}
          </section>
        </div>
      )}
    </main>
  );
}
