import { AI_TIMEOUT_MS, createModuleClient, isRecord, type ModuleResponse } from "./moduleFetch.js";
import { isIsoDate, localDate, shiftDate } from "./dates.js";
import type { ModuleToolPlugin } from "./types.js";

interface JournalStructured {
  title: string; mood: string; summary: string;
  timeline: { time: string; event: string }[]; highlights: string[];
  meals: { type: string; content: string }[]; drinks: string[]; entertainment: string[]; exercise: string[];
  weight?: number | null; thoughts: string; tomorrowPlan: string;
}
interface JournalEntry { id: string; date: string; rawText: string; structured: JournalStructured; updatedAt: string }
type SavedEntry = JournalEntry & { aiError?: string | null };

const TOKEN_HEADER = "X-Journal-Token";
const MAX_RAW_TEXT = 4000;
const MAX_WRITE_TEXT = 5000;
const LOCKED = { journalLocked: true, message: "随手记已锁定，需要用户在对话下方的卡片中输入工作台数据密码解锁" };

const isLocked = (result: ModuleResponse<unknown>) => !result.ok && result.status === 401 && result.body?.code === "JOURNAL_LOCKED";

function resolveDate(value: unknown, today: string): { date: string } | { error: string } {
  if (value === undefined || value === null || value === "") return { date: today };
  if (!isIsoDate(value)) return { error: "日期格式应为 YYYY-MM-DD" };
  if (value > today) return { error: "不能读写未来日期的随手记" };
  return { date: value };
}

const savedResult = (entry: SavedEntry, outcome: "created" | "appended") => ({
  [outcome]: true,
  date: entry.date,
  title: entry.structured.title,
  mood: entry.structured.mood,
  // The AI error text can echo provider details, so only report whether structuring worked.
  organized: !entry.aiError,
  message: `${outcome === "created" ? "已新建" : "已追加到"} ${entry.date} 的随手记${entry.aiError ? "，原文已保存，但 AI 整理失败，可以稍后在随手记详情中点“重新分析”" : ""}`,
});

export function createJournalPlugin({ baseUrl }: { baseUrl: string }): ModuleToolPlugin {
  const request = createModuleClient({ baseUrl, label: "工具" });

  return {
    name: "journal",
    label: "随手记",
    summary: "查看最近的随手记、读取某一天的内容、新建或追加今天的随手记（需要用户解锁，不能删除或覆盖）",
    intent: /随手记|日记|journal/i,
    sensitive: true,
    prompt: `随手记模块使用提示：
- journal_write 的 text 只放用户想记下的内容本身（去掉“帮我记一下”之类的指令语），保持用户原话的意思和语气，不要编造；用户没说要记什么时先问清楚。
- 同一天已经有随手记时，journal_write 会把内容追加到原文后面并重新整理，不会覆盖原有内容。
- 引用随手记内容回答时只回答用户问到的部分。
- 用户在卡片中解锁后会发送“已解锁随手记，请继续”：接着完成之前因锁定没做完的随手记操作即可，其他已经完成的操作不要重复执行。`,
    tools: [
      {
        name: "journal_list",
        label: "最近随手记",
        risk: "read",
        description: "列出最近若干天的随手记：日期、标题、心情和摘要（最新在前）。",
        input_schema: {
          type: "object",
          properties: { days: { type: "number", description: "最近几天，默认 7，最多 31" } },
        },
      },
      {
        name: "journal_read",
        label: "查看随手记",
        risk: "read",
        description: "读取某一天的随手记：整理后的时间线、亮点、饮食、运动、感想、明日计划，以及原文。",
        input_schema: {
          type: "object",
          properties: { date: { type: "string", description: "日期 YYYY-MM-DD，默认今天" } },
        },
      },
      {
        name: "journal_write",
        label: "写随手记",
        risk: "write",
        description: "写随手记：这一天还没有就新建，已经有了就把新内容追加到原文后面，再由 AI 重新整理标题、心情和摘要。",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string", description: "要记下的内容" },
            date: { type: "string", description: "日期 YYYY-MM-DD，默认今天，不能是未来日期" },
          },
          required: ["text"],
        },
      },
    ],

    async execute(name, args, ctx) {
      const token = ctx.journalToken;
      if (!token) return LOCKED;
      const headers = { [TOKEN_HEADER]: token };
      const today = localDate();

      switch (name) {
        case "journal_list": {
          const days = Math.min(31, Math.max(1, Math.trunc(typeof args.days === "number" ? args.days : 7)));
          const result = await request<JournalEntry[]>("GET", "/api/journal", { headers });
          if (isLocked(result)) return LOCKED;
          if (!result.ok) return { error: result.error };
          const from = shiftDate(today, -(days - 1));
          const entries = result.data
            .filter((entry) => entry.date >= from)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((entry) => ({ date: entry.date, title: entry.structured.title, mood: entry.structured.mood, summary: entry.structured.summary }));
          return { from, to: today, entries };
        }

        case "journal_read": {
          const resolved = resolveDate(args.date, today);
          if ("error" in resolved) return resolved;
          const result = await request<JournalEntry>("GET", `/api/journal/date/${resolved.date}`, { headers });
          if (isLocked(result)) return LOCKED;
          if (!result.ok) return result.status === 404 ? { found: false, date: resolved.date } : { error: result.error };
          const { structured, rawText } = result.data;
          return {
            found: true,
            date: result.data.date,
            title: structured.title,
            mood: structured.mood,
            summary: structured.summary,
            timeline: structured.timeline,
            highlights: structured.highlights,
            meals: structured.meals,
            drinks: structured.drinks,
            entertainment: structured.entertainment,
            exercise: structured.exercise,
            weightKg: typeof structured.weight === "number" ? structured.weight : undefined,
            thoughts: structured.thoughts,
            tomorrowPlan: structured.tomorrowPlan || undefined,
            rawText: rawText.slice(0, MAX_RAW_TEXT),
            rawTextTruncated: rawText.length > MAX_RAW_TEXT || undefined,
          };
        }

        case "journal_write": {
          const text = typeof args.text === "string" ? args.text.trim() : "";
          if (!text) return { error: "要记下的内容不能为空" };
          if (text.length > MAX_WRITE_TEXT) return { error: `内容太长了，一次最多 ${MAX_WRITE_TEXT} 字` };
          const resolved = resolveDate(args.date, today);
          if ("error" in resolved) return resolved;

          const existing = await request<JournalEntry>("GET", `/api/journal/date/${resolved.date}`, { headers });
          if (isLocked(existing)) return LOCKED;
          if (!existing.ok && existing.status !== 404) return { error: existing.error };

          if (!existing.ok) {
            const created = await request<SavedEntry>("POST", "/api/journal", { headers, body: { rawText: text, date: resolved.date }, timeoutMs: AI_TIMEOUT_MS });
            if (isLocked(created)) return LOCKED;
            if (!created.ok) return { error: created.status === 409 ? "这一天的随手记刚刚已被创建，请再试一次" : created.error };
            return savedResult(created.data, "created");
          }

          const updated = await request<SavedEntry>("PUT", `/api/journal/${encodeURIComponent(existing.data.id)}`, {
            headers,
            body: { rawText: `${existing.data.rawText}\n\n${text}` },
            timeoutMs: AI_TIMEOUT_MS,
          });
          if (isLocked(updated)) return LOCKED;
          if (!updated.ok) return { error: updated.error };
          return savedResult(updated.data, "appended");
        }

        default:
          return { error: `未知工具：${name}` };
      }
    },
  };
}

export type JournalUnlockResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; status: number; error: string; retryAfter?: number };

export interface JournalGateway {
  unlock(password: string): Promise<JournalUnlockResult>;
  lock(token: string): Promise<void>;
}

export function createJournalGateway(baseUrl: string): JournalGateway {
  const request = createModuleClient({ baseUrl, label: "工具" });

  return {
    async unlock(password) {
      const result = await request("POST", "/api/journal-lock/unlock", { body: { password } });
      if (result.ok) {
        const data = isRecord(result.data) ? result.data : {};
        if (typeof data.token !== "string" || typeof data.expiresAt !== "number") {
          return { ok: false, status: 502, error: "工具服务返回的解锁结果不正确" };
        }
        return { ok: true, token: data.token, expiresAt: data.expiresAt };
      }
      const retryAfter = result.body?.retryAfter;
      return {
        ok: false,
        status: result.status || 502,
        error: result.error,
        retryAfter: typeof retryAfter === "number" ? retryAfter : undefined,
      };
    },

    async lock(token) {
      await request("POST", "/api/journal-lock/lock", { headers: { [TOKEN_HEADER]: token } });
    },
  };
}
