import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Mic } from "lucide-react";
import { journeyApi } from "../journeyApi";
import type { Place } from "../journeyTypes";

interface Recognition {
  lang: string; onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void;
}
export default function PlaceSearch({ label, value, onChange, near, hotel, initialQuery = "" }: {
  label: string; value: Place | null; onChange: (place: Place | null) => void; near?: Place; hotel?: boolean; initialQuery?: string;
}) {
  const [query, setQuery] = useState(value?.name || initialQuery);
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [listening, setListening] = useState(false);
  const revision = useRef(0);
  const recognition = useRef<Recognition | null>(null);
  const localEdit = useRef(false);
  useEffect(() => {
    if (localEdit.current) { localEdit.current = false; return; }
    setQuery(value?.name || initialQuery);
  }, [value?.id, initialQuery]);
  useEffect(() => () => { revision.current++; recognition.current?.stop(); }, []);
  useEffect(() => { revision.current++; setResults([]); setSearched(false); setBusy(false); }, [near?.id]);
  function edit(text: string) {
    revision.current++; setQuery(text); setResults([]); setSearched(false); setBusy(false); setError("");
    if (value) { localEdit.current = true; onChange(null); }
  }
  async function search() {
    const token = ++revision.current;
    setBusy(true); setError(""); setResults([]);
    try {
      const places = await journeyApi.places(query.trim(), near, hotel ? "hotel" : undefined);
      if (token === revision.current) { setResults(places); setSearched(true); }
    } catch (e) { if (token === revision.current) setError((e as Error).message); }
    finally { if (token === revision.current) setBusy(false); }
  }
  function dictate() {
    const ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!ctor) { setError("当前环境不支持语音识别，请输入地点"); return; }
    if (listening) { recognition.current?.stop(); return; }
    const instance = new ctor(); recognition.current = instance; instance.lang = "zh-CN";
    instance.onresult = event => edit(event.results[0][0].transcript.replace(/[。！？]$/, ""));
    instance.onerror = () => { setError("语音识别失败，请检查麦克风权限或直接输入"); setListening(false); };
    instance.onend = () => setListening(false);
    try { instance.start(); setListening(true); } catch { setError("无法启动语音识别"); }
  }
  return <section className="ow-place-search">
    <label>{label}<span>请从搜索结果确认具体地点</span>
      <div className="ow-search-row">
        <input aria-label={label} value={query} placeholder={hotel ? "酒店名称，或留空查周边酒店" : "城市 + 地点 / 具体入口"} maxLength={60} onChange={e => edit(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
        <button type="button" title={listening ? "停止语音" : "说出地点"} aria-label="语音输入地点" onClick={dictate}><Mic size={16} className={listening ? "text-accent" : ""} /></button>
        <button type="button" aria-label={"搜索" + label} disabled={busy || (!query.trim() && !near)} onClick={() => void search()}><Search size={17} /></button>
      </div>
    </label>
    {busy && <p role="status">正在搜索高德地点…</p>}
    {error && <p className="ow-error" role="alert">{error}</p>}
    {value && <div className="ow-selected-place"><MapPin size={15}/><div><b>{value.name}</b><small>{value.address}</small></div></div>}
    {!busy && searched && !results.length && <p>没有匹配地点，请补充城市或换一个名称。</p>}
    <div className="ow-search-results">{results.map(place => <button type="button" key={place.id} onClick={() => { onChange(place); setQuery(place.name); setResults([]); setSearched(false); }}>
      <b>{place.name}</b><small>{place.address}</small>
    </button>)}</div>
  </section>;
}
