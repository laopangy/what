import { useEffect, useRef, useState } from "react";
import { Mountain, Route, Bookmark, ArrowRight, ArrowLeft, Check, MapPin, Clock, Trash2, Save, Car, Bike, Footprints, ImageOff } from "lucide-react";
import { api } from "./api";
import { journeyApi } from "./journeyApi";
import type { Candidate, Journey, MapStatus, Place, TripDraft } from "./journeyTypes";
import type { Itinerary } from "./types";
import PlaceSearch from "./components/PlaceSearch";
import AmapView from "./components/AmapView";
import NumberField from "./components/NumberField";
import DurationField, { formatDuration } from "./components/DurationField";
import { groupRecommendations } from "./recommendationGroups";

const travelerLabels = [["adults", "成年人（不含老人）"], ["seniors", "老人"], ["children", "儿童"], ["women", "其中女性（可选）"]] as const;
type TravelerField = typeof travelerLabels[number][0];

const steps = ["时间与范围", "交通与活动", "目的地与路线", "过夜与住宿", "完整行程"];
const modeNames = {driving: "自驾", cycling: "公路车骑行", transit: "公共交通", rail: "高铁 / 铁路"};
const activityNames = {hiking: "徒步爬山", cycling: "骑车探索", touring: "风景游览", leisure: "轻松旅游"};
const today = () => new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Shanghai"}).format(new Date());
const initialDraft = (): TripDraft => ({
  origin: null, startDate: today(), endDate: today(), startTime: "08:00", endTime: "20:00",
  maxMinutes: 120, maxKm: null, people: 0, travelers: {adults: 0, seniors: 0, children: 0, women: 0}, mode: "driving", activity: "leisure",
  activityMinutes: 180, activityKm: 10, rideTotalKm: null, rideShape: "return", rideVia: null, destination: null, dailyPlaces: [], activityEnd: null,
  lodging: "recommend", hotel: null, rooms: 1, hotelBudget: 400, hotelPreference: "",
});
const dayCount = (d: TripDraft) => Math.round((Date.parse(d.endDate) - Date.parse(d.startDate)) / 86400000) + 1;
function Photo({ place }: { place: Place }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [place.id]);
  return place.photos[0] && !failed ? <img src={place.photos[0].url} alt={place.photos[0].title || place.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> :
    <div className="ow-photo-empty"><ImageOff size={23}/><span>暂无该地点图片</span></div>;
}
export default function App() {
  const [draft, setDraft] = useState<TripDraft>(initialDraft);
  const [addedTravelers, setAddedTravelers] = useState<TravelerField[]>([]);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<MapStatus>({ready: false, serviceReady: false, jsReady: false});
  const [home, setHome] = useState("");
  const [view, setView] = useState<"planner" | "saved">("planner");
  const [journey, setJourney] = useState<Journey | null>(null);
  const [saved, setSaved] = useState<Journey[]>([]);
  const [legacy, setLegacy] = useState<Itinerary[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateNote, setCandidateNote] = useState("");
  const [selected, setSelected] = useState("");
  const [activeDay, setActiveDay] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const revision = useRef(0);
  const days = dayCount(draft);
  const travelers = draft.travelers || {adults: draft.people, seniors: 0, children: 0, women: 0};
  function changeTravelers(field: keyof typeof travelers, value: number | null) {
    const next = {...travelers, [field]: value ?? 0};
    change({travelers: next, people: next.adults + next.seniors + next.children});
  }
  useEffect(() => {
    let disposed = false;
    void Promise.all([journeyApi.status(), journeyApi.saved(), api.settings(), api.plans()]).then(([map, plans, settings, old]) => {
      if (disposed) return;
      setStatus(map); setSaved(plans); setHome(settings.homeAddress); setLegacy(old);
    }).catch(e => { if (!disposed) setError((e as Error).message + "；如仓库未解锁，请先在工作台输入数据密码。"); });
    return () => { disposed = true; revision.current++; };
  }, []);
  function change(patch: Partial<TripDraft>, resetDestination = false) {
    revision.current++; setBusy(""); setError(""); setNotice(""); setJourney(null); setSelected("");
    setCandidates([]); setCandidateNote("");
    setDraft(previous => ({ ...previous, ...patch, ...(resetDestination ? {destination: null, dailyPlaces: [], activityEnd: null, hotel: null} : {}) }));
  }
  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  function validateFirst() {
    if (!draft.origin) throw new Error("请搜索并确认出发地");
    if (!draft.startDate || !draft.endDate || !Number.isFinite(days) || days < 1 || days > 7) throw new Error("请选择 1 至 7 天的有效起止日期");
    if (!draft.startTime || !draft.endTime || (days === 1 && draft.endTime <= draft.startTime)) throw new Error("请检查出发与返程截止时间");
    if (draft.maxMinutes === null && draft.maxKm === null) throw new Error("单程交通时间和单程距离至少填写一项");
    if ((draft.maxMinutes !== null && (!Number.isInteger(draft.maxMinutes) || draft.maxMinutes < 1 || draft.maxMinutes > 1440)) || (draft.maxKm !== null && (draft.maxKm < 1 || draft.maxKm > 3000))) throw new Error("交通时长应在 24 小时以内，距离应为 1～3000 公里");
    if (Object.values(travelers).some(n => !Number.isInteger(n) || n < 0) || travelers.women > draft.people) throw new Error("人员数量需为非负整数，女性人数不能超过总人数");
    if (draft.people < 1 || draft.people > 30) throw new Error("同行人数应为 1～30");
  }
  async function next() {
    await run("正在检查条件", async () => {
      validateFirst();
      if (step === 1 && !["driving", "cycling"].includes(draft.mode)) throw new Error("请重新选择自驾或骑行");
      if (step === 1 && (!Number.isInteger(draft.activityMinutes) || draft.activityMinutes < 30 || draft.activityMinutes > 480)) throw new Error("每天活动预算应为 0 小时 30 分钟～8 小时");
      if (step === 2 && !draft.destination) throw new Error("请先选择目的地，或从推荐结果中选择");
      if (step === 2 && draft.mode !== "cycling" && ["hiking", "cycling"].includes(draft.activity) && !draft.activityEnd) throw new Error("请确认活动折返点，以计算徒步/骑行往返路线");
      if (step === 3) {
        if (days > 1 && (!draft.hotel || draft.lodging === "later")) throw new Error("请先确认酒店位置，完整行程需要计算住宿接驳");
        const token = ++revision.current;
        const result = await journeyApi.generate(draft);
        if (token !== revision.current) return;
        setJourney(result); setActiveDay(result.events[0].day); setSelected(result.events[0].id);
      }
      setStep(previous => Math.min(4, previous + 1));
    });
  }
  async function recommend() {
    await run("正在搜索地点并逐一校验往返路线，可能需要一些时间…", async () => {
      validateFirst(); const token = ++revision.current;
      const result = await journeyApi.recommend(draft);
      if (token !== revision.current) return;
      setCandidates(result.candidates); setCandidateNote(result.note);
    });
  }
  const events = journey?.events.filter(event => event.day === activeDay) || [];
  const currentEvent = events.find(event => event.id === selected) || events[0];
  const previewPlaces = journey ? events.map(event => event.place) : [draft.origin, draft.rideVia, draft.destination, draft.activityEnd, draft.hotel].filter((place): place is Place => Boolean(place));
  const places = [...new Map(previewPlaces.map(place => [place.id, place])).values()];
  const legs = events.flatMap(event => event.leg ? [event.leg] : []);
  const distance = journey?.events.reduce((sum, event) => sum + (event.leg?.km || 0), 0) || 0;
  const travelMinutes = journey?.events.reduce((sum, event) => sum + (event.leg?.minutes || 0), 0) || 0;
  const distanceGroups = groupRecommendations(candidates, draft.maxKm);
  return <div className="outdoor-root ow-root">
    <header className="outdoor-local-header">
      <div><Mountain size={22} className="text-accent"/><h1>户外</h1><p>把想去的地方，变成走得通的行程。</p></div>
      <div className="outdoor-header-actions">
        <span>{status.ready ? "地图已配置" : "请前往账号与服务配置高德地图"}</span>
        <nav aria-label="户外导航">
          <button className={view === "planner" ? "is-active" : ""} onClick={() => setView("planner")}><Route size={15}/>规划行程</button>
          <button className={view === "saved" ? "is-active" : ""} onClick={() => setView("saved")}><Bookmark size={15}/>我的行程<span>{saved.length + legacy.length}</span></button>
        </nav>
      </div>
    </header>
    <div className="ow-scroll">
      {error && <div className="ow-banner ow-error" role="alert">{error}<button onClick={() => setError("")} aria-label="关闭错误">×</button></div>}
      {notice && <div className="ow-banner" role="status">{notice}</div>}
      {busy && <div className="ow-banner" role="status"><span className="ow-pulse"/>{busy}</div>}
      {view === "saved" ? <main className="ow-saved">
        <h2>我的行程</h2><p>新路线保存到加密仓库；重新出发前请更新路线数据。</p>
        {!saved.length && !legacy.length && <div className="ow-empty"><Bookmark size={32}/><h3>还没有保存的行程</h3><button className="ow-button" onClick={() => setView("planner")}>开始规划</button></div>}
        {saved.map(item => <article key={item.id}><div><h3>{item.title}</h3><p>{item.draft.startDate} — {item.draft.endDate} · {modeNames[item.draft.mode]}</p></div>
          <button className="ow-button" onClick={() => { revision.current++; setDraft(item.draft); setAddedTravelers([]); setJourney(item); setActiveDay(item.events[0].day); setSelected(item.events[0].id); setStep(4); setView("planner"); }}>查看行程</button>
          <button className="ow-button" aria-label={"删除" + item.title} onClick={() => setConfirmDelete(item.id)}><Trash2 size={15}/></button>
          {confirmDelete === item.id && <button className="ow-button ow-danger" disabled={!!busy} onClick={() => void run("正在删除", async () => { await journeyApi.remove(item.id); setSaved(saved.filter(p => p.id !== item.id)); setConfirmDelete(""); })}>确认删除</button>}
          {confirmDelete === item.id && <button className="ow-button" onClick={() => setConfirmDelete("")}>取消</button>}
        </article>)}
        {legacy.map(item => <article key={item.id}><div><h3>{item.title} · 旧版估算</h3><p>{item.intent.origin} → {item.intent.destination}。旧示意图已停用，原记录仍保留。</p>
          <details><summary>查看旧行程文字</summary>{item.stops.map(stop => <p key={stop.id}>{stop.arrivalAt} · {stop.title}（未核实）</p>)}</details></div>
          <button className="ow-button" onClick={() => { setView("planner"); setStep(0); setJourney(null); setNotice("请重新搜索确认旧行程的出发地和目的地，使用真实路线规划。"); }}>重新规划</button>
          <button className="ow-button" aria-label={"删除旧行程" + item.title} onClick={() => setConfirmDelete(item.id)}><Trash2 size={15}/></button>
          {confirmDelete === item.id && <><button className="ow-button ow-danger" disabled={!!busy} onClick={() => void run("正在删除旧行程", async () => { await api.remove(item.id); setLegacy(legacy.filter(p => p.id !== item.id)); setConfirmDelete(""); })}>确认删除</button><button className="ow-button" onClick={() => setConfirmDelete("")}>取消</button></>}
        </article>)}
      </main> : <main className="ow-main">
        <nav className="ow-steps" aria-label="行程规划步骤">{steps.map((label, index) => <button key={label} disabled={!!busy || index > step} aria-current={index === step ? "step" : undefined} className={index === step ? "is-current" : index < step ? "is-complete" : ""} onClick={() => { setStep(index); setError(""); }}>
          <span>{index < step ? <Check size={15}/> : index + 1}</span><b>{label}</b>
        </button>)}</nav>
        <div className="ow-layout">
          <section className="ow-form-panel">
            <div className="ow-section-title"><span>STEP 0{step + 1}</span><h2>{["先定好时间，再决定走多远", "怎么去，到了之后怎么玩", "有目的地直接选，没想好就探索", days === 1 ? "当天往返，不必安排酒店" : "给旅程安排一个落脚点", "从出发到回家，都安排清楚"][step]}</h2></div>
            <fieldset disabled={!!busy}>
            {step === 0 && <>
              <PlaceSearch label="从哪里出发" value={draft.origin} initialQuery={home} onChange={origin => change({origin})}/>
              {draft.origin && <button className="ow-text-button" onClick={() => void run("正在保存家庭地址", async () => { await api.saveSettings({homeAddress: draft.origin!.address + " " + draft.origin!.name}); setHome(draft.origin!.name); setNotice("已设为家的默认搜索地址，下一次仍需确认具体地点。"); })}>将这里设为家</button>}
              <div className="ow-fields">
                <label>出发日期<input type="date" value={draft.startDate} onChange={e => change({startDate: e.target.value})}/></label>
                <label>返程日期<input type="date" value={draft.endDate} onChange={e => change({endDate: e.target.value})}/></label>
                <label>出发时间<input type="time" value={draft.startTime} onChange={e => change({startTime: e.target.value})}/></label>
                <label>最晚到家<input type="time" value={draft.endTime} onChange={e => change({endTime: e.target.value})}/></label>
                <DurationField label="单程交通上限" value={draft.maxMinutes} optional onChange={maxMinutes => change({maxMinutes})}/>
                <label>单程距离上限 / 公里<NumberField label="单程距离上限 / 公里" min={1} max={3000} value={draft.maxKm} placeholder="与时间至少填写一项" onChange={maxKm => change({maxKm})}/></label>
                <label className="col-span-full">同行人员
                  <select aria-label="添加同行人员类别" value="" onChange={event => {
                    const field = travelerLabels.find(([key]) => key === event.target.value)?.[0];
                    if (field) setAddedTravelers(previous => [...previous, field]);
                  }}>
                    <option value="" disabled>＋ 添加人员类别</option>
                    {travelerLabels.filter(([field]) => !addedTravelers.includes(field) && travelers[field] === 0).map(([field, label]) => <option key={field} value={field}>{label}</option>)}
                  </select>
                </label>
                {travelerLabels.filter(([field]) => addedTravelers.includes(field) || travelers[field] > 0).map(([field, label]) => <div key={field}>
                  <label>{label}<NumberField label={label} value={travelers[field] || null} max={30} placeholder="填写人数" onChange={value => { setAddedTravelers(previous => previous.includes(field) ? previous : [...previous, field]); changeTravelers(field, value); }}/></label>
                  <button type="button" className="ow-text-button" aria-label={"移除" + label} onClick={() => {
                    setAddedTravelers(previous => previous.filter(key => key !== field));
                    changeTravelers(field, 0);
                  }}>移除</button>
                </div>)}
                <p className="ow-help">{draft.people ? '同行共 ' + draft.people + ' 人。' : '请按需添加人员类别并填写人数。'}女性人数包含在年龄分组中，不重复计数；仅作同行信息，不据此推断体力。</p>
              </div>
              <p className="ow-help">时间按北京时间计算，支持 1～7 天。单程限制用于交通路段；徒步/骑行活动另设上限。搜索时地点将发送至高德。</p>
            </>}
            {step === 1 && <>
              <label className="ow-group-label">到达目的地的交通方式</label><div className="ow-options">
                {(["driving", "cycling"] as const).map((key, index) => { const label = modeNames[key]; const Icon = [Car, Bike][index]; return <button key={key} aria-pressed={draft.mode === key} className={draft.mode === key ? "is-picked" : ""} onClick={() => change({mode: key, activity: key === "cycling" ? "cycling" : "leisure", activityEnd: null, rideVia: null, destination: null})}><Icon size={22}/><b>{label}</b></button>; })}
              </div>
              {draft.mode !== "cycling" && <><label className="ow-group-label">这次想做什么</label><div className="ow-options">
                {Object.entries(activityNames).map(([key, label], index) => { const Icon = [Footprints, Bike, Car, Mountain][index]; return <button key={key} aria-pressed={draft.activity === key} className={draft.activity === key ? "is-picked" : ""} onClick={() => change({activity: key as TripDraft["activity"], activityEnd: null})}><Icon size={22}/><b>{label}</b></button>; })}
              </div>
              </>}
              {draft.mode === "cycling" && <><p className="ow-help">公路车享受骑行过程，不以景区游玩为目标。目的地请选道路交汇处或骑行补给点；普通骑行导航不等于已验证的公路车路线。</p><div className="ow-options">{([["return", "往返骑行"], ["loop", "途经点环线"]] as const).map(([value,label]) => <button key={value} className={(draft.rideShape || "return") === value ? "is-picked" : ""} onClick={() => change({rideShape:value,rideVia:null})}>{label}</button>)}</div><label>骑行总里程上限 / 公里（可选）<NumberField label="骑行总里程上限 / 公里" value={draft.rideTotalKm ?? null} min={1} max={2000} onChange={rideTotalKm => change({rideTotalKm})}/></label><p className="ow-help">单程 50 公里的往返可能接近 100 公里。环线按完整总里程筛选，去程和返程也保留已设的单程限制；环线目前支持当天骑行，可能有重合路段。</p></>}
              <div className="ow-fields"><DurationField label={draft.mode === "cycling" ? "每天骑行时间预算" : "每天活动预算"} value={draft.activityMinutes} onChange={value => change({activityMinutes: value ?? 0})}/>
                {draft.mode !== "cycling" && ["hiking", "cycling"].includes(draft.activity) && <label>活动往返上限 / 公里<NumberField label="活动往返上限 / 公里" min={1} max={200} value={draft.activityKm} onChange={value => change({activityKm: value ?? 0})}/></label>}
              </div>
              <p className="ow-help">交通和活动独立选择，例如「自驾到目的地，再骑车」。当前重点支持自驾和骑行；旧行程中的公共交通记录仍可查看，重新规划请改选自驾或骑行。</p>
            </>}
            {step === 2 && <>
              {draft.mode === "cycling" && draft.rideShape === "loop" && <PlaceSearch label="环线途经点" near={draft.origin || undefined} value={draft.rideVia || null} onChange={rideVia => change({rideVia})}/>}
              <PlaceSearch label={draft.mode === "cycling" ? "公路车终点（路口或补给点）" : "想去的目的地"} value={draft.destination} onChange={destination => change({destination, dailyPlaces: [], hotel: null, activityEnd: null})}/>
              <div className="ow-discover"><div><b>还没想好去哪？</b><p>{draft.mode === "cycling" ? "按实际骑行道路找路线，校验终点路段与往返总里程。" : "根据交通、活动与时间范围，查找可达地点。"}</p></div><button className="ow-button ow-primary" onClick={() => void recommend()}>帮我推荐</button></div>
              {candidateNote && <p className="ow-help">{candidateNote}</p>}
              {candidateNote && <div className="ow-distance-groups">{distanceGroups.map(group => <section key={group.label}><h3>{group.label}<small> · {group.items.length} {draft.mode === "cycling" ? "条路线" : "个地点"}</small></h3>{!group.items.length && <p className="ow-help">本次检索暂无匹配结果，不代表该范围没有可选路线。</p>}<div className="ow-candidates">{group.items.map(candidate => <button className="ow-candidate" key={candidate.place.id} onClick={() => change({destination: candidate.place, hotel: null, dailyPlaces: [], activityEnd: null})}>
                <Photo place={candidate.place}/><div><b>{draft.mode === "cycling" ? (draft.rideShape === "loop" ? "途经点环线 · " : "公路车往返 · ") : ""}{candidate.place.name}</b><p>去程 {candidate.outbound.minutes} 分钟 · {candidate.outbound.km.toFixed(1)} km</p><small>返程 {candidate.returnRoute.km.toFixed(1)} km / {formatDuration(candidate.returnRoute.minutes)} · 总里程 {(candidate.outbound.km + candidate.returnRoute.km).toFixed(1)} km</small>{draft.mode === "cycling" ? <><p>总骑行 {formatDuration(candidate.outbound.minutes + candidate.returnRoute.minutes)}</p><small>路面 / 爬升 / 车流 / 补给 / 终点通行：待核实</small><p>{candidate.outbound.instructions.slice(0,3).join(" → ") || "道路名称未返回，请生成后查看地图细线"}</p></> : <small>地点图片：高德 · 停车与开放待核实</small>}</div><ArrowRight size={17}/>
              </button>)}</div></section>)}</div>}
              {draft.destination && draft.mode !== "cycling" && ["hiking", "cycling"].includes(draft.activity) && <PlaceSearch label="活动折返点（会沿实际道路返回）" near={draft.destination} value={draft.activityEnd} onChange={activityEnd => change({activityEnd})}/>}
              {draft.destination && days > 1 && <details className="ow-details"><summary>调整每天游玩的地点（默认都在目的地）</summary>
                {Array.from({length: Math.min(7, Math.max(1, days))}, (_, index) => <PlaceSearch key={index} label={"第 " + (index + 1) + " 天"} value={draft.dailyPlaces[index] || draft.destination} onChange={place => {
                  const dailyPlaces = Array.from({length: days}, (_, i) => draft.dailyPlaces[i] || draft.destination!);
                  dailyPlaces[index] = place || draft.destination!; change({dailyPlaces});
                }}/>)}
              </details>}
              <p className="ow-help">建议选择具体入口。徒步是普通步行道路规划，山路开放、海拔与安全性待核实；没有真实图片时不使用无关风景替代。</p>
            </>}
            {step === 3 && (days === 1 ? <div className="ow-empty"><Check size={32}/><h3>当天出发，当天回家</h3><p>将直接生成交通、活动、用餐留白与返程路线。</p></div> : <>
              <div className="ow-stay-summary">{draft.startDate} 入住 → {draft.endDate} 退房 · {days - 1} 晚</div>
              <div className="ow-options ow-options-three">{([["recommend", "找酒店"], ["booked", "我已订好"], ["later", "稍后决定"]] as const).map(([value, label]) => <button key={value} className={draft.lodging === value ? "is-picked" : ""} onClick={() => change({lodging: value, hotel: null})}>{label}</button>)}</div>
              <div className="ow-fields"><label>每间每晚预算 / 元<NumberField label="每间每晚预算 / 元" min={50} max={20000} value={draft.hotelBudget} onChange={value => change({hotelBudget: value ?? 0})}/></label>
                <label>房间数<NumberField label="房间数" min={1} max={20} value={draft.rooms} onChange={value => change({rooms: value ?? 0})}/></label></div>
              <label>住宿偏好 / 搜索关键词<input maxLength={60} value={draft.hotelPreference} placeholder="例如：民宿、温泉、停车" onChange={e => change({hotelPreference: e.target.value, hotel: null})}/></label>
              {draft.lodging !== "later" ? <PlaceSearch label={draft.lodging === "booked" ? "确认已订酒店位置" : "目的地周边酒店"} value={draft.hotel} near={draft.destination || undefined} hotel initialQuery={draft.hotelPreference} onChange={hotel => change({hotel})}/> : <p className="ow-help">可以先返回调整其他条件。生成完整路线前需要确认住宿位置，不会虚构酒店接驳。</p>}
              <p className="ow-help">当前使用同一酒店作为多日基地。预算和偏好是意向，不代表匹配到实时房价或设施；选择酒店不产生预订。</p>
            </>)}
            {step === 4 && journey && <>
              <h3>{journey.title}</h3><div className="ow-stats"><div><b>{distance.toFixed(1)}<small> km</small></b><span>规划路段总距离</span></div><div><b>{travelMinutes}<small> 分钟</small></b><span>交通及活动移动时间</span></div></div>
              <p>同行 {draft.people} 人 · 成年人 {travelers.adults} / 老人 {travelers.seniors} / 儿童 {travelers.children} · 其中女性 {travelers.women}</p>
              <p>{draft.startDate} {draft.startTime} → {draft.endDate} {draft.endTime} 前到家</p>
              <p className="ow-help">高德路线数据 + 本地时间编排 · 保存的是查询快照，不是实时导航。</p>
              <div className="ow-warnings">{journey.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>
              {days > 1 && <p className="ow-help">住宿意向预算合计：¥{draft.hotelBudget * draft.rooms * (days - 1)}，非报价，不含交通与餐饮。</p>}
              <button className="ow-button ow-primary ow-wide" onClick={() => void run("正在加密保存", async () => {
                const result = await journeyApi.save(journey); setJourney(result); setSaved([result, ...saved.filter(p => p.id !== result.id)]); setNotice("完整行程已加密保存");
              })}><Save size={16}/>{journey.saved ? "更新已保存行程" : "保存完整行程"}</button>
              <button className="ow-button ow-wide" onClick={() => { setStep(3); setNotice("确认条件后重新生成，将重新查询全部路线。"); }}>修改条件 / 重新计算</button>
            </>}
            </fieldset>
            <footer className="ow-form-footer"><button className="ow-button" disabled={step === 0 || !!busy} onClick={() => { setStep(step - 1); setError(""); }}><ArrowLeft size={15}/>上一步</button>
              {step < 4 && <button className="ow-button ow-primary" disabled={!!busy} onClick={() => void next()}>{step === 3 ? "生成完整行程" : "下一步"}<ArrowRight size={15}/></button>}
            </footer>
          </section>
          <section className="ow-result">
            <div className="ow-result-heading"><div><span className="ow-kicker">旅程预览</span><h2>{journey?.title || draft.destination?.name || "下一次出发，从这里开始"}</h2></div><span className="ow-source">{status.ready ? "高德地图" : "待配置地图"}</span></div>
            {journey && <nav className="ow-days" aria-label="每日行程">{[...new Set(journey.events.map(event => event.day))].map((day, index) => <button className={activeDay === day ? "is-picked" : ""} key={day} onClick={() => {setActiveDay(day); setSelected("");}}>{index + 1} 日 · {day.slice(5)}</button>)}</nav>}
            <AmapView ready={status.jsReady} places={places} legs={legs} selected={currentEvent?.place.id || selected} onSelect={id => setSelected(events.find(event => event.place.id === id)?.id || id)}/>
            {!journey ? <div className="ow-preview-summary">
              <div><MapPin size={18}/><span>从哪里出发<b>{draft.origin?.name || "先确认出发地点"}</b></span></div>
              <div><Clock size={18}/><span>出行范围<b>单程 {formatDuration(draft.maxMinutes)}{draft.maxKm ? " / " + draft.maxKm + " km" : ""}</b></span></div>
              <p>填好条件后，地图会显示地点；生成行程后才展示高德返回的路线，不用直线假装道路。</p>
            </div> : <>
              <div className="ow-timeline">{events.map(event => <button key={event.id} className={currentEvent?.id === event.id ? "is-picked" : ""} onClick={() => setSelected(event.id)}>
                <time>{event.start}—{event.end}</time><b>{event.title}</b><small>{event.note}</small>
              </button>)}</div>
              {currentEvent && <article className="ow-event-detail"><Photo place={currentEvent.place}/><div><span className="ow-kicker">当前节点</span><h3>{currentEvent.title}</h3><p>{currentEvent.place.address}</p>
                <p>{currentEvent.note}</p><small>地点与图片来源：高德 POI；图片可能为用户上传，仅供参考。</small>
                {currentEvent.leg && <details><summary>路段说明 · {currentEvent.leg.km.toFixed(1)} km / {currentEvent.leg.minutes} 分钟</summary>
                  <p>查询时间：{new Date(currentEvent.leg.queriedAt).toLocaleString("zh-CN")}</p>
                  {!currentEvent.leg.paths.length && <p>该路段未返回路线几何，地图不连线。请在高德中核实。</p>}
                  {currentEvent.leg.warning && <p>{currentEvent.leg.warning}</p>}
                  {currentEvent.leg.instructions.map((instruction, i) => <p key={i}>{instruction}</p>)}</details>}
                <a target="_blank" rel="noreferrer" href={"https://uri.amap.com/marker?position=" + currentEvent.place.location.join(",") + "&name=" + encodeURIComponent(currentEvent.place.name) + "&coordinate=gaode&callnative=1"}>在高德查看此地点 ↗</a>
              </div></article>}
            </>}
          </section>
        </div>
      </main>}
    </div>
  </div>;
}
