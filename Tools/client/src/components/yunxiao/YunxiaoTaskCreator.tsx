import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Loader2, Sparkles } from "lucide-react";

interface Connection { requirementUrl: string; token: string }
interface Requirement {
  id: string; serialNumber: string; subject: string; projectId: string; projectName: string;
  organizationId: string;
  assigneeId: string; assigneeName: string;
}
interface TaskType { id: string; name: string; defaultType: boolean }
interface Field {
  id: string; name: string; type: string; required: boolean;
  defaultValue?: string; options?: Array<{ id: string; displayValue?: string; value?: string }>;
}
interface Draft {
  subject: string; description: string; estimatedHours: number | null;
  estimateBasis: "explicit" | "inferred" | "missing" | "edited"; rationale: string;
  result?: { id: string; effortSaved: boolean; warning?: string };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/yunxiao/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
  return data;
}

const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-400";
const labelClass = "mb-1.5 block text-xs font-semibold text-slate-400";

export default function YunxiaoTaskCreator() {
  const [connection, setConnection] = useState<Connection>({ requirementUrl: "", token: "" });
  const [context, setContext] = useState<{ requirement: Requirement; taskTypes: TaskType[] } | null>(null);
  const [taskTypeId, setTaskTypeId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const updateConnection = (key: keyof Connection, value: string) => {
    setConnection((current) => ({ ...current, [key]: value }));
    setContext(null);
    setDrafts([]);
    setFields([]);
    setFieldsReady(false);
    setTaskTypeId("");
  };

  const loadFields = async (selectedType: string, requirement: Requirement) => {
    const data = await post<{ fields: Field[] }>("fields", {
      connection, organizationId: requirement.organizationId,
      projectId: requirement.projectId, taskTypeId: selectedType,
    });
    setFields(data.fields);
    setFieldsReady(true);
    setFieldValues(Object.fromEntries(data.fields
      .filter((field) => field.defaultValue).map((field) => [field.id, field.defaultValue ?? ""])));
  };

  const connect = async () => {
    setBusy("connect"); setError(""); setContext(null); setDrafts([]); setFieldsReady(false);
    try {
      const data = await post<{ requirement: Requirement; taskTypes: TaskType[] }>("context", { connection });
      setContext(data);
      setAssigneeId(data.requirement.assigneeId);
      const selected = data.taskTypes.find((type) => type.defaultType) ?? data.taskTypes[0];
      setTaskTypeId(selected.id);
      await loadFields(selected.id, data.requirement);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "连接云效失败"); }
    finally { setBusy(""); }
  };

  const changeTaskType = async (value: string) => {
    if (!context) return;
    setTaskTypeId(value); setBusy("fields"); setError(""); setFieldsReady(false);
    try { await loadFields(value, context.requirement); }
    catch (cause) { setFields([]); setError(cause instanceof Error ? cause.message : "读取字段失败"); }
    finally { setBusy(""); }
  };

  const analyze = async () => {
    if (!context || !fieldsReady) return;
    setBusy("analyze"); setError(""); setDrafts([]);
    try {
      const data = await post<{ tasks: Draft[] }>("analyze", {
        text: rawText, requirementSubject: context.requirement.subject,
      });
      setDrafts(data.tasks);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "分析失败"); }
    finally { setBusy(""); }
  };

  const updateDraft = (index: number, patch: Partial<Draft>) => {
    setDrafts((current) => current.map((draft, position) =>
      position === index ? { ...draft, ...patch } : draft));
  };

  const create = async (index: number) => {
    if (!context || !fieldsReady) return;
    const draft = drafts[index];
    if (!draft || draft.result) return;
    if (!draft.estimatedHours || draft.estimatedHours <= 0) {
      setError("请先补充大于 0 的预计工时，再创建任务"); return;
    }
    setBusy(`create-${index}`); setError("");
    try {
      const result = await post<{ id: string; effortSaved: boolean; warning?: string }>("create", {
        connection, organizationId: context.requirement.organizationId,
        parentId: context.requirement.id,
        projectId: context.requirement.projectId, taskTypeId, assigneeId,
        customFieldValues: fieldValues,
        task: {
          subject: draft.subject, description: draft.description,
          estimatedHours: draft.estimatedHours,
          estimateBasis: draft.estimateBasis === "missing" ? "edited" : draft.estimateBasis,
        },
      });
      updateDraft(index, { result });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); }
    finally { setBusy(""); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-5 md:p-7">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-400">
          <ClipboardList className="h-4 w-4" /> 项目协作
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 md:text-3xl">云效任务创建</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          连接需求，整理文字中的任务和预计工时。逐条检查并确认后，才会写入云效。
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-100">1 · 连接云效需求</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className={labelClass}>需求详情链接</span>
            <input className={inputClass} type="url" value={connection.requirementUrl}
              onChange={(event) => updateConnection("requirementUrl", event.target.value)}
              placeholder="https://devops.aliyun.com/projex/req/WBGA-13685#" />
          </label>
          <label className="md:col-span-2"><span className={labelClass}>个人访问令牌</span>
            <input className={inputClass} type="password" value={connection.token}
              onChange={(event) => updateConnection("token", event.target.value)}
              placeholder="在云效个人设置中创建" autoComplete="off" />
          </label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          直接粘贴具体需求的链接，不用找组织 ID 或内部工作项 ID。令牌需具备组织只读、项目只读、工作项读写及预计工时读写权限；仅用于本次请求，不保存。
        </p>
        <button type="button" onClick={connect}
          disabled={Boolean(busy) || !connection.requirementUrl || !connection.token}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          读取需求
        </button>
      </section>

      {context && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-100">2 · 任务归属</h2>
        <div className="mb-4 rounded-xl border border-indigo-500/20 bg-indigo-500/8 p-3">
          <p className="text-xs text-slate-500">父需求 · {context.requirement.projectName}</p>
          <p className="mt-1 font-medium text-slate-100">{context.requirement.subject}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {context.requirement.serialNumber} · {context.requirement.id}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label><span className={labelClass}>任务类型</span>
            <select className={inputClass} value={taskTypeId} onChange={(event) => void changeTaskType(event.target.value)}>
              {context.taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </label>
          <label><span className={labelClass}>负责人 User ID</span>
            <input className={inputClass} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}
              placeholder="云效用户 ID" />
            <span className="mt-1 block text-xs text-slate-500">默认继承需求负责人{context.requirement.assigneeName ? `：${context.requirement.assigneeName}` : "；请填写负责人 ID"}</span>
          </label>
          {fields.map((field) => <label key={field.id}>
            <span className={labelClass}>{field.name} · 云效必填</span>
            {field.options?.length ? <select className={inputClass} value={fieldValues[field.id] ?? ""}
              onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}>
              <option value="">请选择</option>
              {field.options.map((option) => <option key={option.id} value={option.id}>
                {option.displayValue || option.value || option.id}</option>)}
            </select> : <input className={inputClass} value={fieldValues[field.id] ?? ""}
              onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
              placeholder={`填写 ${field.name}`} />}
          </label>)}
        </div>
      </section>}

      {context && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-100">3 · 描述你的工作</h2>
        <textarea className={`${inputClass} min-h-40 resize-y leading-relaxed`} value={rawText}
          onChange={(event) => { setRawText(event.target.value); setDrafts([]); }}
          placeholder="例如：完成登录页错误提示和接口校验，前端约 3 小时，后端约 2 小时；补充验收用例……" />
        <p className="mt-2 text-xs text-slate-500">
          文字会发送给已配置的 DeepSeek 进行解析；令牌不会发送给 AI。没有明确工时的推测值会标注，所有结果都可修改。
        </p>
        <button type="button" onClick={analyze} disabled={Boolean(busy) || !fieldsReady || rawText.trim().length < 5}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          分析并生成草稿
        </button>
      </section>}

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {drafts.length > 0 && <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">4 · 检查并创建</h2>
          <p className="mt-1 text-xs text-slate-500">共 {drafts.length} 条草稿。每条任务单独提交，避免误创建。</p>
        </div>
        {drafts.map((draft, index) => <article key={index} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-indigo-400">任务 {index + 1}</span>
            <span className="text-xs text-slate-500">
              {draft.estimateBasis === "explicit" ? "工时来自原文" : draft.estimateBasis === "inferred" ? "AI 推测工时" : draft.estimateBasis === "edited" ? "已手动调整工时" : "待补充工时"}
            </span>
          </div>
          <div className="space-y-3">
            <label><span className={labelClass}>标题</span>
              <input className={inputClass} value={draft.subject} disabled={Boolean(draft.result)}
                onChange={(event) => updateDraft(index, { subject: event.target.value })} />
            </label>
            <label><span className={labelClass}>需求与验收描述</span>
              <textarea className={`${inputClass} min-h-32 resize-y`} value={draft.description}
                disabled={Boolean(draft.result)}
                onChange={(event) => updateDraft(index, { description: event.target.value })} />
            </label>
            <label className="block max-w-xs"><span className={labelClass}>预计工时（小时）</span>
              <input className={inputClass} type="number" min="0.1" max="1000" step="0.1"
                value={draft.estimatedHours ?? ""} disabled={Boolean(draft.result)}
                onChange={(event) => updateDraft(index, {
                  estimatedHours: event.target.value === "" ? null : Number(event.target.value),
                  estimateBasis: "edited",
                })} />
            </label>
            {draft.rationale && <p className="text-xs leading-relaxed text-slate-500">工时依据：{draft.rationale}</p>}
          </div>
          {draft.result ? <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> 已创建 · {draft.result.id}
            {draft.result.warning && <span className="text-amber-300">{draft.result.warning}</span>}
          </div> : <button type="button" onClick={() => void create(index)}
            disabled={Boolean(busy) || !fieldsReady || !assigneeId.trim() || !draft.subject.trim() || !draft.description.trim()
              || !draft.estimatedHours || fields.some((field) => !fieldValues[field.id]?.trim() && !field.defaultValue)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/12 px-4 py-2.5 text-sm font-semibold text-indigo-300 disabled:cursor-not-allowed disabled:opacity-40">
            {busy === `create-${index}` && <Loader2 className="h-4 w-4 animate-spin" />}
            确认创建此任务
          </button>}
        </article>)}
      </section>}
    </div>
  );
}
