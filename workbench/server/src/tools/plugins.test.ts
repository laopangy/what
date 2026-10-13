import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { formatLocalDateTime, localDate, shiftDate, weekdayName, weekdayOf } from "./dates.js";
import { createFitnessPlugin } from "./fitnessPlugin.js";
import { createJournalGateway, createJournalPlugin } from "./journalPlugin.js";
import { createModuleClient, type ModuleResponse } from "./moduleFetch.js";
import { createOutdoorPlugin } from "./outdoorPlugin.js";
import { createTimerPlugin } from "./timerPlugin.js";

interface Received { method: string; path: string; headers: IncomingHttpHeaders; body: unknown }
interface Reply { status?: number; body?: unknown; headers?: Record<string, string>; delayMs?: number }
type Routes = Record<string, (request: Received) => Reply>;

async function mockModule(t: TestContext, routes: Routes) {
  const received: Received[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString("utf-8");
    const request = { method: req.method ?? "", path: req.url ?? "", headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
    received.push(request);
    const reply = routes[`${request.method} ${request.path}`]?.(request) ?? { status: 404, body: { error: "未找到" } };
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
    res.writeHead(reply.status ?? 200, { "Content-Type": "application/json; charset=utf-8", ...reply.headers });
    res.end(reply.body === undefined ? undefined : typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, received };
}

// Mirrors what the model receives: undefined fields disappear.
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const today = localDate();
const yesterday = shiftDate(today, -1);
const tomorrow = shiftDate(today, 1);

function fitnessState() {
  return {
    profile: {
      name: "张三", sex: "male", age: 30, heightCm: 175,
      goal: "lose", targetWeightKg: 70, targetDate: "2027-01-01", goalPaceStatus: "on_track", weightKg: 75,
      mealCalorieTargets: { breakfast: 500, lunch: 700, dinner: 600, snack: 200 },
      calorieTarget: 2000, proteinTarget: 150, carbsTarget: 200, fatTarget: 60, waterTarget: 2500,
    },
    plan: {
      sessions: [
        {
          id: "weekly", name: "每周胸部", weekday: weekdayOf(today), focus: "胸", activityType: "strength", targetDurationMinutes: 60,
          exercises: [{ id: "bench", name: "卧推", muscle: "胸", sets: 4, reps: "8-10" }],
        },
        { id: "special", name: "特别安排", weekday: weekdayOf(today), scheduledDate: today, focus: "腿", activityType: "strength", targetDurationMinutes: 45, exercises: [] },
      ],
    },
    workoutLogs: [],
    meals: [
      { id: "m1", date: today, mealType: "breakfast", name: "燕麦", amount: "1碗", calories: 300, protein: 10, carbs: 50, fat: 5 },
      { id: "m2", date: today, mealType: "lunch", name: "牛肉面", amount: "1碗", calories: 650.5, protein: 30.5, carbs: 80, fat: 20 },
      { id: "m3", date: yesterday, mealType: "dinner", name: "米饭", amount: "1碗", calories: 200, protein: 4, carbs: 45, fat: 1 },
    ],
    weights: [{ date: today, weightKg: 74.5, bodyFat: 18 }],
  };
}

interface TodayResult {
  date: string; weekday: string; targets: unknown; intake: unknown; remaining: unknown; goal: unknown; latestWeight: unknown;
  meals: { id: string }[]; plannedSession?: { id: string };
}

test("fitness_today reports intake and remaining targets without private profile fields", async (t) => {
  const server = await mockModule(t, { "GET /api/fitness/state": () => ({ body: fitnessState() }) });
  const plugin = createFitnessPlugin({ baseUrl: server.baseUrl });
  const result = await plugin.execute("fitness_today", {}, {}) as TodayResult;

  assert.equal(result.date, today);
  assert.equal(result.weekday, weekdayName(weekdayOf(today)));
  assert.deepEqual(result.targets, { calories: 2000, protein: 150, carbs: 200, fat: 60, waterMl: 2500, mealCalories: { 早餐: 500, 午餐: 700, 晚餐: 600, 加餐: 200 } });
  assert.deepEqual(result.intake, { calories: 950.5, protein: 40.5, carbs: 130, fat: 25 });
  assert.deepEqual(result.remaining, { calories: 1049.5, protein: 109.5, carbs: 70, fat: 35 });
  assert.deepEqual(result.meals.map((meal) => meal.id), ["m1", "m2"]);
  assert.deepEqual(json(result.meals[1]), { id: "m2", date: today, mealType: "午餐", name: "牛肉面", amount: "1碗", calories: 650.5, protein: 30.5, carbs: 80, fat: 20 });
  assert.equal(result.plannedSession?.id, "special");
  assert.deepEqual(result.latestWeight, { date: today, weightKg: 74.5, bodyFat: 18 });
  assert.deepEqual(result.goal, { goal: "减脂", targetWeightKg: 70, targetDate: "2027-01-01", pace: "进度合理" });
  const serialized = JSON.stringify(result);
  for (const secret of ["张三", '"sex"', '"age"', '"heightCm"']) assert.ok(!serialized.includes(secret), secret);

  const lastWeek = await plugin.execute("fitness_today", { date: shiftDate(today, -7) }, {}) as TodayResult;
  assert.equal(lastWeek.plannedSession?.id, "weekly");
  assert.deepEqual(lastWeek.meals, []);

  const requests = server.received.length;
  assert.deepEqual(await plugin.execute("fitness_today", { date: "2026-13-01" }, {}), { error: "日期格式应为 YYYY-MM-DD" });
  assert.equal(server.received.length, requests);
});

test("fitness_log_meal sends the description and date to the meal parser", async (t) => {
  const meal = { id: "m9", date: today, mealType: "lunch", name: "牛肉面", amount: "1碗", calories: 650, protein: 30, carbs: 80, fat: 20 };
  const server = await mockModule(t, {
    "POST /api/fitness/meals/from-text": () => ({ body: { meal, calculation: { unmatched: [], note: "按常见分量估算" } } }),
  });
  const plugin = createFitnessPlugin({ baseUrl: server.baseUrl });

  assert.deepEqual(json(await plugin.execute("fitness_log_meal", { text: " 午餐 牛肉面一碗 " }, {})), {
    logged: true,
    meal: { ...meal, mealType: "午餐" },
    note: "按常见分量估算",
    message: `已记录到 ${today} 午餐`,
  });
  assert.deepEqual(server.received.map(({ method, path, body }) => ({ method, path, body })), [
    { method: "POST", path: "/api/fitness/meals/from-text", body: { query: "午餐 牛肉面一碗", date: today } },
  ]);

  assert.deepEqual(await plugin.execute("fitness_log_meal", { text: "午餐 面", date: tomorrow }, {}), { error: "不能记录未来日期" });
  assert.deepEqual(await plugin.execute("fitness_log_meal", { text: "  " }, {}), { error: "请说明吃了什么" });
  assert.equal(server.received.length, 1);
});

test("fitness_log_weight validates the range and reports a replaced entry", async (t) => {
  const server = await mockModule(t, {
    "GET /api/fitness/state": () => ({ body: fitnessState() }),
    "POST /api/fitness/weights": ({ body }) => ({ body }),
  });
  const plugin = createFitnessPlugin({ baseUrl: server.baseUrl });

  assert.deepEqual(await plugin.execute("fitness_log_weight", { weightKg: 20 }, {}), { error: "体重应在 30-350 公斤之间" });
  assert.equal(server.received.length, 0);
  assert.deepEqual(json(await plugin.execute("fitness_log_weight", { weightKg: 74.24 }, {})), {
    logged: true, date: today, weightKg: 74.2, replacedWeightKg: 74.5,
    message: `已把 ${today} 的体重从 74.5 公斤更新为 74.2 公斤`,
  });
  assert.deepEqual(server.received.at(-1)?.body, { date: today, weightKg: 74.2 });
});

test("fitness_delete_meal confirms with a readable summary and deletes by id", async (t) => {
  const server = await mockModule(t, {
    "GET /api/fitness/state": () => ({ body: fitnessState() }),
    "DELETE /api/fitness/meals/m2": () => ({ body: { success: true } }),
  });
  const plugin = createFitnessPlugin({ baseUrl: server.baseUrl });

  assert.deepEqual(await plugin.prepare?.("fitness_delete_meal", { mealId: "m2" }, {}), { summary: `删除 ${today} 午餐「牛肉面 1碗」（650.5 kcal）` });
  assert.deepEqual(await plugin.prepare?.("fitness_delete_meal", { mealId: "gone" }, {}), { result: { error: "这条饮食记录不存在，可能已被删除" } });
  const requests = server.received.length;
  assert.deepEqual(await plugin.prepare?.("fitness_delete_meal", { mealId: "../m2" }, {}), { result: { error: "饮食记录 id 不正确" } });
  assert.equal(server.received.length, requests);

  assert.deepEqual(await plugin.execute("fitness_delete_meal", { mealId: "m2" }, {}), { deleted: true, message: "已删除这条饮食记录" });
  assert.equal(server.received.at(-1)?.method, "DELETE");
});

const timers = [
  {
    id: "t1", name: "巡检", description: "", cronExpression: "0 9 * * *", taskType: "http-request", enabled: true, isScheduled: true,
    lastRunAt: "2026-10-12T01:00:00.000Z", nextRunAt: "2026-10-13T01:00:00.000Z",
    taskConfig: { url: "https://example.com/hook?token=abc123", headers: { Authorization: "Bearer hidden-value" } },
  },
  {
    id: "t2", name: "备份", description: "每日备份", cronExpression: "0 2 * * *", taskType: "shell-command", enabled: false, isScheduled: false,
    taskConfig: { command: "backup.sh --password hunter2" },
  },
];

const executions = [
  { timerId: "t2", timerName: "备份", startedAt: "2026-10-09T01:00:00.000Z", status: "running" },
  {
    timerId: "t1", timerName: "巡检", startedAt: "2026-10-12T01:00:00.000Z", finishedAt: "2026-10-12T01:00:02.000Z",
    status: "success", result: 'HTTP 200 OK\n{"secret":"value"}',
  },
  {
    timerId: "t1", timerName: "巡检", startedAt: "2026-10-13T01:00:00.000Z", finishedAt: "2026-10-13T01:00:01.000Z",
    status: "success", result: "HTTP 503 Service Unavailable\n<html>busy</html>",
  },
  {
    timerId: "t2", timerName: "备份", startedAt: "2026-10-11T01:00:00.000Z", finishedAt: "2026-10-11T01:00:30.000Z", status: "failed",
    error: "connect ECONNREFUSED https://api.example.com/v1?key=supersecret token abcdefghijklmnopqrstuvwxyz0123456789ABCD",
  },
  {
    timerId: "t2", timerName: "备份", startedAt: "2026-10-10T01:00:00.000Z", finishedAt: "2026-10-10T01:01:00.000Z",
    status: "success", result: "Exit code: 2\nStdout: done\nStderr: warning: low disk\nError: permission denied",
  },
];

test("timer_list hides task configuration", async (t) => {
  const server = await mockModule(t, { "GET /api/timer": () => ({ body: timers }) });
  const result = await createTimerPlugin({ baseUrl: server.baseUrl }).execute("timer_list", {}, {});
  const serialized = JSON.stringify(result);
  for (const secret of ["taskConfig", "hidden-value", "hunter2", "abc123"]) assert.ok(!serialized.includes(secret), secret);
  assert.deepEqual((json(result) as { timers: unknown[] }).timers[0], {
    id: "t1", name: "巡检", cron: "0 9 * * *", taskType: "HTTP 请求", enabled: true, scheduled: true,
    lastRunAt: formatLocalDateTime("2026-10-12T01:00:00.000Z"), nextRunAt: formatLocalDateTime("2026-10-13T01:00:00.000Z"),
  });
});

test("timer_history summarizes outcomes newest first and redacts failure reasons", async (t) => {
  const server = await mockModule(t, {
    "GET /api/timer/history/all": () => ({ body: executions }),
    "GET /api/timer/t1/history": () => ({ body: executions.filter((record) => record.timerId === "t1") }),
  });
  const plugin = createTimerPlugin({ baseUrl: server.baseUrl });
  const result = await plugin.execute("timer_history", {}, {});

  assert.deepEqual(json(result), {
    total: 5,
    records: [
      { timerId: "t1", timerName: "巡检", startedAt: formatLocalDateTime("2026-10-13T01:00:00.000Z"), durationSeconds: 1, status: "失败", httpStatus: 503, reason: "HTTP 503 Service Unavailable" },
      { timerId: "t1", timerName: "巡检", startedAt: formatLocalDateTime("2026-10-12T01:00:00.000Z"), durationSeconds: 2, status: "成功", httpStatus: 200 },
      { timerId: "t2", timerName: "备份", startedAt: formatLocalDateTime("2026-10-11T01:00:00.000Z"), durationSeconds: 30, status: "失败", reason: "connect ECONNREFUSED https://api.example.com/v1?… token …" },
      { timerId: "t2", timerName: "备份", startedAt: formatLocalDateTime("2026-10-10T01:00:00.000Z"), durationSeconds: 60, status: "失败", exitCode: 2, reason: "Error: permission denied" },
      { timerId: "t2", timerName: "备份", startedAt: formatLocalDateTime("2026-10-09T01:00:00.000Z"), status: "执行中" },
    ],
  });
  assert.ok(!JSON.stringify(result).includes("secret"));

  const limited = await plugin.execute("timer_history", { timerId: "t1", limit: 1 }, {}) as { total: number; records: unknown[] };
  assert.equal(limited.total, 2);
  assert.equal(limited.records.length, 1);
  assert.equal(server.received.at(-1)?.path, "/api/timer/t1/history");

  const requests = server.received.length;
  assert.deepEqual(await plugin.execute("timer_history", { timerId: "../x" }, {}), { error: "定时任务 id 不正确" });
  assert.equal(server.received.length, requests);
});

test("timer_toggle skips no-op changes both before and after confirmation", async (t) => {
  let current = { ...timers[0] };
  const server = await mockModule(t, {
    "GET /api/timer/t1": () => ({ body: current }),
    "GET /api/timer/missing": () => ({ status: 404, body: { error: "Timer not found" } }),
    "POST /api/timer/t1/toggle": () => {
      current = { ...current, enabled: !current.enabled, isScheduled: !current.enabled };
      return { body: current };
    },
  });
  const plugin = createTimerPlugin({ baseUrl: server.baseUrl });

  assert.deepEqual(await plugin.prepare?.("timer_toggle", { timerId: "t1", enabled: true }, {}), { result: { unchanged: true, message: "「巡检」已经是启用状态" } });
  assert.deepEqual(await plugin.prepare?.("timer_toggle", { timerId: "t1", enabled: "no" }, {}), { result: { error: "请说明要启用还是停用" } });
  assert.deepEqual(await plugin.prepare?.("timer_toggle", { timerId: "missing", enabled: false }, {}), { result: { error: "定时任务不存在" } });
  assert.deepEqual(await plugin.prepare?.("timer_toggle", { timerId: "t1", enabled: false }, {}), { summary: "停用定时任务「巡检」，停用后不会再按计划自动执行" });

  assert.deepEqual(await plugin.execute("timer_toggle", { timerId: "t1", enabled: false }, {}), { enabled: false, scheduled: false, message: "已停用「巡检」" });
  assert.deepEqual(await plugin.execute("timer_toggle", { timerId: "t1", enabled: false }, {}), { unchanged: true, message: "「巡检」已经是停用状态" });
  assert.equal(server.received.filter((request) => request.path.endsWith("/toggle")).length, 1);
});

test("timer_trigger confirms with the task type and starts the run", async (t) => {
  const server = await mockModule(t, {
    "GET /api/timer/t2": () => ({ body: timers[1] }),
    "POST /api/timer/t2/trigger": () => ({ body: { message: "started" } }),
  });
  const plugin = createTimerPlugin({ baseUrl: server.baseUrl });
  assert.deepEqual(await plugin.prepare?.("timer_trigger", { timerId: "t2" }, {}), { summary: "立即执行定时任务「备份」（Shell 命令）" });
  assert.deepEqual(await plugin.execute("timer_trigger", { timerId: "t2" }, {}), { triggered: true, message: "已开始执行「备份」，结果稍后可在执行历史中查看" });
});

const JOURNEY_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const home = { name: "家", address: "某某路 88 号", location: [120.1, 30.1] };
const journey = {
  id: JOURNEY_ID, title: "莫干山徒步", createdAt: "2026-10-01T02:00:00.000Z", warnings: [],
  draft: { startDate: "2026-10-20", endDate: "2026-10-21", people: 2, mode: "driving", activity: "hiking", origin: home, destination: { name: "莫干山", address: "德清县" } },
  events: [
    { day: "2026-10-20", title: "出发", start: "08:00", end: "08:00", kind: "departure", place: home },
    { day: "2026-10-20", title: "徒步", start: "10:00", end: "15:00", kind: "activity", place: { name: "莫干山", address: "德清县" }, leg: { mode: "driving", minutes: 95.4, km: 82.36 } },
    { day: "2026-10-21", title: "返程", start: "16:00", end: "18:00", kind: "return", place: home },
  ],
};

test("outdoor journeys never expose the departure address", async (t) => {
  const server = await mockModule(t, { "GET /api/outdoor/journeys": () => ({ body: [journey] }) });
  const plugin = createOutdoorPlugin({ baseUrl: server.baseUrl });

  const list = await plugin.execute("outdoor_list_journeys", {}, {});
  assert.deepEqual(json(list), {
    journeys: [{
      id: JOURNEY_ID, title: "莫干山徒步", dates: "2026-10-20 ~ 2026-10-21", activity: "徒步爬山", mode: "自驾",
      destination: "莫干山", people: 2, events: 3, savedAt: formatLocalDateTime("2026-10-01T02:00:00.000Z"),
    }],
  });

  const detail = await plugin.execute("outdoor_get_journey", { journeyId: JOURNEY_ID }, {}) as { events: { place: string; travel?: unknown }[] };
  assert.deepEqual(detail.events.map((event) => event.place), ["出发地", "莫干山", "出发地"]);
  assert.deepEqual(detail.events[1].travel, { mode: "自驾", minutes: 95, km: 82.4 });
  for (const result of [list, detail]) {
    const serialized = JSON.stringify(result);
    for (const secret of ["某某路", "120.1", "德清县"]) assert.ok(!serialized.includes(secret), secret);
  }

  const requests = server.received.length;
  assert.deepEqual(await plugin.execute("outdoor_get_journey", { journeyId: "abc" }, {}), { error: "行程 id 不正确" });
  assert.equal(server.received.length, requests);
  assert.deepEqual(await plugin.execute("outdoor_get_journey", { journeyId: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed" }, {}), { error: "行程不存在或尚未保存" });
});

test("outdoor_sync_calendar checks the calendar setup before asking for confirmation", async (t) => {
  let status: unknown = { connected: false, calendarId: "", calendars: [] };
  const server = await mockModule(t, {
    "GET /api/outdoor/calendar/status": () => ({ body: status }),
    "GET /api/outdoor/journeys": () => ({ body: [journey] }),
    [`POST /api/outdoor/journeys/${JOURNEY_ID}/calendar`]: () => ({ body: { count: 3, calendarName: "个人" } }),
  });
  const plugin = createOutdoorPlugin({ baseUrl: server.baseUrl });
  const prepare = (journeyId: string) => plugin.prepare?.("outdoor_sync_calendar", { journeyId }, {});

  assert.deepEqual(await prepare(JOURNEY_ID), { result: { error: "请先在户外的账号与服务中连接 iCloud 日历" } });
  status = { connected: true, calendarId: "gone", calendars: [{ id: "c1", name: "个人" }] };
  assert.deepEqual(await prepare(JOURNEY_ID), { result: { error: "请先在户外的账号与服务中选择目标日历并保存" } });
  status = { connected: true, calendarId: "c1", calendars: [{ id: "c1", name: "个人" }] };
  assert.deepEqual(await prepare("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed"), { result: { error: "行程不存在或尚未保存" } });
  assert.deepEqual(await prepare(JOURNEY_ID), {
    summary: "把行程「莫干山徒步」（2026-10-20 ~ 2026-10-21，3 项日程）同步到苹果日历「个人」，会覆盖这个行程之前同步过的日程，包括在手机上做的修改",
  });

  assert.deepEqual(await plugin.execute("outdoor_sync_calendar", { journeyId: JOURNEY_ID }, {}), {
    synced: true, count: 3, calendarName: "个人", message: "已同步 3 项日程到苹果日历「个人」",
  });
});

const TOKEN = "journal-session-token-0001";
const LOCKED = { journalLocked: true, message: "随手记已锁定，需要用户在对话下方的卡片中输入工作台数据密码解锁" };
const NOT_FOUND: Reply = { status: 404, body: { error: "该日期没有日记" } };

const journalEntry = (date: string, rawText = "早上喝了咖啡") => ({
  id: `j-${date}`, date, rawText, updatedAt: "2026-10-13T01:00:00.000Z",
  structured: {
    title: "平静的一天", mood: "平静", summary: "喝咖啡", timeline: [{ time: "08:00", event: "喝咖啡" }], highlights: ["咖啡"],
    meals: [], drinks: ["咖啡"], entertainment: [], exercise: [], weight: null, thoughts: "还不错", tomorrowPlan: "",
  },
});

test("journal tools stay locked without a token and never call the Tools service", async (t) => {
  const server = await mockModule(t, {});
  const plugin = createJournalPlugin({ baseUrl: server.baseUrl });
  for (const [name, args] of [["journal_list", {}], ["journal_read", {}], ["journal_write", { text: "记一下" }]] as const) {
    assert.deepEqual(await plugin.execute(name, args, {}), LOCKED, name);
  }
  assert.equal(server.received.length, 0);
});

test("an expired Tools session maps to the locked result and the token travels only in the header", async (t) => {
  const server = await mockModule(t, {
    "GET /api/journal": () => ({ status: 401, body: { success: false, error: "随手记已锁定，请输入工作台数据密码", code: "JOURNAL_LOCKED" } }),
  });
  assert.deepEqual(await createJournalPlugin({ baseUrl: server.baseUrl }).execute("journal_list", {}, { journalToken: TOKEN }), LOCKED);
  assert.equal(server.received[0].headers["x-journal-token"], TOKEN);
  assert.ok(!server.received[0].path.includes(TOKEN));
});

test("journal_list returns the recent window newest first", async (t) => {
  const server = await mockModule(t, {
    "GET /api/journal": () => ({ body: [journalEntry(shiftDate(today, -6)), journalEntry(shiftDate(today, -7)), journalEntry(today)] }),
  });
  assert.deepEqual(await createJournalPlugin({ baseUrl: server.baseUrl }).execute("journal_list", {}, { journalToken: TOKEN }), {
    from: shiftDate(today, -6),
    to: today,
    entries: [today, shiftDate(today, -6)].map((date) => ({ date, title: "平静的一天", mood: "平静", summary: "喝咖啡" })),
  });
});

test("journal_read returns structured content, truncates long originals and rejects bad dates", async (t) => {
  const server = await mockModule(t, {
    [`GET /api/journal/date/${today}`]: () => ({ body: journalEntry(today, "字".repeat(4_100)) }),
    [`GET /api/journal/date/${yesterday}`]: () => NOT_FOUND,
  });
  const plugin = createJournalPlugin({ baseUrl: server.baseUrl });
  const ctx = { journalToken: TOKEN };

  const entry = json(await plugin.execute("journal_read", {}, ctx)) as { title: string; rawText: string; rawTextTruncated?: boolean; weightKg?: number; tomorrowPlan?: string };
  assert.equal(entry.title, "平静的一天");
  assert.equal(entry.rawText.length, 4_000);
  assert.equal(entry.rawTextTruncated, true);
  assert.equal(entry.weightKg, undefined);
  assert.equal(entry.tomorrowPlan, undefined);
  assert.deepEqual(await plugin.execute("journal_read", { date: yesterday }, ctx), { found: false, date: yesterday });

  const requests = server.received.length;
  assert.deepEqual(await plugin.execute("journal_read", { date: tomorrow }, ctx), { error: "不能读写未来日期的随手记" });
  assert.deepEqual(await plugin.execute("journal_read", { date: "2026-02-30" }, ctx), { error: "日期格式应为 YYYY-MM-DD" });
  assert.equal(server.received.length, requests);
});

test("journal_write creates a missing day and appends to an existing one without leaking AI errors", async (t) => {
  const existing = journalEntry(today);
  const server = await mockModule(t, {
    [`GET /api/journal/date/${yesterday}`]: () => NOT_FOUND,
    "POST /api/journal": () => ({ status: 201, body: { ...journalEntry(yesterday, "跑了 5 公里"), aiError: null } }),
    [`GET /api/journal/date/${today}`]: () => ({ body: existing }),
    [`PUT /api/journal/${existing.id}`]: ({ body }) => ({ body: { ...existing, ...(body as object), aiError: "provider said: invalid key sk-123" } }),
  });
  const plugin = createJournalPlugin({ baseUrl: server.baseUrl });
  const ctx = { journalToken: TOKEN };

  assert.deepEqual(await plugin.execute("journal_write", { text: " 跑了 5 公里 ", date: yesterday }, ctx), {
    created: true, date: yesterday, title: "平静的一天", mood: "平静", organized: true, message: `已新建 ${yesterday} 的随手记`,
  });
  assert.deepEqual(server.received.find((request) => request.method === "POST")?.body, { rawText: "跑了 5 公里", date: yesterday });

  const appended = await plugin.execute("journal_write", { text: "下午开会" }, ctx);
  assert.deepEqual(appended, {
    appended: true, date: today, title: "平静的一天", mood: "平静", organized: false,
    message: `已追加到 ${today} 的随手记，原文已保存，但 AI 整理失败，可以稍后在随手记详情中点“重新分析”`,
  });
  assert.deepEqual(server.received.find((request) => request.method === "PUT")?.body, { rawText: "早上喝了咖啡\n\n下午开会" });
  assert.ok(!JSON.stringify(appended).includes("sk-123"));
  assert.ok(server.received.every((request) => request.headers["x-journal-token"] === TOKEN));
});

test("journal_write validates input before any request and explains a creation race", async (t) => {
  const server = await mockModule(t, {
    [`GET /api/journal/date/${today}`]: () => NOT_FOUND,
    "POST /api/journal": () => ({ status: 409, body: { error: "该日期已有日记" } }),
  });
  const plugin = createJournalPlugin({ baseUrl: server.baseUrl });
  const ctx = { journalToken: TOKEN };

  assert.deepEqual(await plugin.execute("journal_write", { text: "  " }, ctx), { error: "要记下的内容不能为空" });
  assert.deepEqual(await plugin.execute("journal_write", { text: "字".repeat(5_001) }, ctx), { error: "内容太长了，一次最多 5000 字" });
  assert.deepEqual(await plugin.execute("journal_write", { text: "明天的事", date: tomorrow }, ctx), { error: "不能读写未来日期的随手记" });
  assert.equal(server.received.length, 0);
  assert.deepEqual(await plugin.execute("journal_write", { text: "今天的事" }, ctx), { error: "这一天的随手记刚刚已被创建，请再试一次" });
});

test("the journal gateway sends the password in the body and passes rate limits through", async (t) => {
  let reply: Reply = { body: { success: true, token: "tok-1", expiresAt: 123 } };
  const server = await mockModule(t, {
    "POST /api/journal-lock/unlock": () => reply,
    "POST /api/journal-lock/lock": () => ({ body: { success: true } }),
  });
  const gateway = createJournalGateway(server.baseUrl);

  assert.deepEqual(await gateway.unlock("密码"), { ok: true, token: "tok-1", expiresAt: 123 });
  assert.deepEqual(server.received[0].body, { password: "密码" });
  assert.equal(server.received[0].headers["content-type"], "application/json; charset=utf-8");

  reply = { status: 429, headers: { "Retry-After": "30" }, body: { success: false, error: "尝试次数过多", retryAfter: 30 } };
  assert.deepEqual(await gateway.unlock("x"), { ok: false, status: 429, error: "尝试次数过多", retryAfter: 30 });
  reply = { status: 401, body: { success: false, error: "密码错误" } };
  assert.deepEqual(await gateway.unlock("x"), { ok: false, status: 401, error: "密码错误", retryAfter: undefined });
  reply = { body: { success: true } };
  assert.deepEqual(await gateway.unlock("x"), { ok: false, status: 502, error: "工具服务返回的解锁结果不正确" });

  await gateway.lock("tok-1");
  assert.equal(server.received.at(-1)?.path, "/api/journal-lock/lock");
  assert.equal(server.received.at(-1)?.headers["x-journal-token"], "tok-1");
});

const errorOf = (response: ModuleResponse<unknown>) => (response.ok ? undefined : response.error);

test("module clients explain offline, slow, locked and failing services in Chinese", async (t) => {
  const closed = createServer();
  closed.listen(0, "127.0.0.1");
  await once(closed, "listening");
  const offline = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`;
  closed.close();
  await once(closed, "close");
  assert.deepEqual(await createModuleClient({ baseUrl: offline, label: "肌肉大" })("GET", "/api/fitness/state"), { ok: false, status: 0, error: "肌肉大服务未启动或无法连接" });
  assert.deepEqual(await createJournalGateway(offline).unlock("x"), { ok: false, status: 502, error: "工具服务未启动或无法连接", retryAfter: undefined });

  const server = await mockModule(t, {
    "GET /slow": () => ({ delayMs: 300, body: {} }),
    "GET /vault": () => ({ status: 423, body: { success: false, error: "Vault locked" } }),
    "GET /message": () => ({ status: 400, body: { message: "参数不对" } }),
    "GET /html": () => ({ status: 500, body: "<html>oops</html>" }),
  });
  const request = createModuleClient({ baseUrl: `${server.baseUrl}/`, label: "工具" });
  assert.equal(errorOf(await request("GET", "/slow", { timeoutMs: 50 })), "工具服务响应超时");
  assert.equal(errorOf(await request("GET", "/vault")), "数据仓库尚未解锁，请先在工作台输入数据密码");
  assert.equal(errorOf(await request("GET", "/message")), "参数不对");
  assert.equal(errorOf(await request("GET", "/html")), "工具服务返回 HTTP 500");
  assert.deepEqual(server.received.map((received) => received.path), ["/slow", "/vault", "/message", "/html"]);
  assert.equal(server.received[0].headers["content-type"], undefined);
});
