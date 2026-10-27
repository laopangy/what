import test from "node:test";
import assert from "node:assert/strict";
import { createChatHandler, type ChatHandlerOptions, type ModelRequest } from "./chatService.js";
import { createPendingActionStore } from "./pendingActions.js";
import { createFitnessPlugin } from "../tools/fitnessPlugin.js";
import { createJournalPlugin } from "../tools/journalPlugin.js";
import { musicPlugin } from "../tools/musicPlugin.js";
import { createOutdoorPlugin } from "../tools/outdoorPlugin.js";
import { createTimerPlugin } from "../tools/timerPlugin.js";
import type { ModuleToolPlugin, ToolContext } from "../tools/types.js";
import type { ChatMessage, DeepSeekContentBlock, DeepSeekResponse } from "../types/chat.js";

const CORE_TOOLS = ["load_module_tools", "open_module"];
const NOW = new Date(2026, 9, 13, 9, 5);

interface Recorded { tool: string; args: Record<string, unknown>; ctx: ToolContext }

function fakePlugin(name: string, intent: RegExp, overrides: Partial<ModuleToolPlugin> = {}) {
  const executed: Recorded[] = [];
  const prepared: Recorded[] = [];
  const plugin: ModuleToolPlugin = {
    name,
    label: name.toUpperCase(),
    summary: `${name} 的能力`,
    intent,
    prompt: `${name} 使用提示`,
    tools: [
      { name: `${name}_read`, label: "读取", risk: "read", description: "读取数据", input_schema: { type: "object", properties: {} } },
      { name: `${name}_danger`, label: "危险操作", risk: "confirm", description: "危险操作", input_schema: { type: "object", properties: {} } },
    ],
    async execute(tool, args, ctx) {
      executed.push({ tool, args, ctx });
      return { done: tool };
    },
    async prepare(tool, args, ctx) {
      prepared.push({ tool, args, ctx });
      return { summary: `确认执行 ${tool}` };
    },
    ...overrides,
  };
  return { plugin, executed, prepared };
}

const ask = (content: string): ChatMessage => ({ role: "user", content });
const answer = (content: string): ChatMessage => ({ role: "assistant", content });
const text = (value: string): DeepSeekResponse => ({ stop_reason: "end_turn", content: [{ type: "text", text: value }] });
const toolUse = (...calls: [name: string, input?: Record<string, unknown>][]): DeepSeekResponse => ({
  stop_reason: "tool_use",
  content: calls.map(([name, input = {}], index) => ({ type: "tool_use", id: `call-${index}`, name, input })),
});

// Replays the scripted replies in order and keeps repeating the last one.
function scriptedModel(...replies: DeepSeekResponse[]) {
  const requests: ModelRequest[] = [];
  const callModel = async (request: ModelRequest) => {
    requests.push(structuredClone(request));
    return structuredClone(replies[Math.min(requests.length, replies.length) - 1]);
  };
  return { requests, callModel };
}

function setup(plugins: ModuleToolPlugin[], model: ReturnType<typeof scriptedModel>, options: Partial<ChatHandlerOptions> = {}) {
  const pending = createPendingActionStore();
  const assistant = createChatHandler({ plugins, callModel: model.callModel, pending, now: () => NOW, ...options });
  return { assistant, pending };
}

const toolNames = (request: ModelRequest) => request.tools.map((tool) => tool.name);

function rawResults(request: ModelRequest): string[] {
  const content = request.messages[request.messages.length - 1].content;
  if (!Array.isArray(content)) throw new Error("expected a tool result turn");
  return content.map((block) => block.content ?? "");
}
const toolResults = (request: ModelRequest): unknown[] => rawResults(request).map((content) => JSON.parse(content));

test("intent routing loads only the module each message is about", async () => {
  const offline = "http://127.0.0.1:9";
  const plugins = [
    createFitnessPlugin({ baseUrl: offline }), createTimerPlugin({ baseUrl: offline }), createOutdoorPlugin({ baseUrl: offline }),
    musicPlugin, createJournalPlugin({ baseUrl: offline }),
  ];
  const owner = new Map(plugins.flatMap((plugin) => plugin.tools.map((tool) => [tool.name, plugin.name] as const)));
  const cases: [string, string[]][] = [
    ["1+1等于几", []],
    ["午饭吃了一碗牛肉面，帮我记一下", ["fitness"]],
    ["今天还能吃多少热量？", ["fitness"]],
    ["定时任务最近执行得怎么样？", ["timer"]],
    ["我最近保存的行程有哪些？", ["outdoor"]],
    ["播放周杰伦的晴天", ["music"]],
    ["帮我写今天的随手记", ["journal"]],
  ];
  for (const [message, expected] of cases) {
    const model = scriptedModel(text("好的"));
    await setup(plugins, model).assistant.handleChat([ask(message)], {});
    const [request] = model.requests;
    assert.deepEqual(toolNames(request).slice(0, 2), CORE_TOOLS, message);
    assert.deepEqual([...new Set(toolNames(request).flatMap((name) => owner.get(name) ?? []))], expected, message);
  }
});

test("short follow-ups reuse modules from the previous three messages only", async () => {
  const music = fakePlugin("music", /播放/);
  const run = async (messages: ChatMessage[]) => {
    const model = scriptedModel(text("好的"));
    await setup([music.plugin], model).assistant.handleChat(messages, {});
    return toolNames(model.requests[0]);
  };
  assert.ok((await run([ask("播放晴天"), answer("找到两个版本：1. 周杰伦 2. 翻唱"), ask("第一个")])).includes("music_read"));
  assert.deepEqual(await run([ask("第一个")]), CORE_TOOLS);
  assert.deepEqual(await run([ask("播放晴天"), answer("a"), ask("b"), answer("c"), ask("第一个")]), CORE_TOOLS);
  assert.deepEqual(await run([ask("播放晴天"), answer("好的"), ask("今天天气怎么样")]), CORE_TOOLS);
});

test("load_module_tools activates a module for the next step and stays out of tool calls", async () => {
  const beta = fakePlugin("beta", /贝塔/);
  const model = scriptedModel(toolUse(["load_module_tools", { module: "beta" }]), toolUse(["beta_read", { q: 1 }]), text("完成"));
  const response = await setup([fakePlugin("alpha", /阿尔法/).plugin, beta.plugin], model).assistant.handleChat([ask("帮我看看")], {});

  assert.deepEqual(toolNames(model.requests[0]), CORE_TOOLS);
  assert.ok(!model.requests[0].system.includes("beta 使用提示"));
  assert.deepEqual(toolResults(model.requests[1]), [{ loaded: "beta", tools: ["beta_read", "beta_danger"] }]);
  assert.deepEqual(toolNames(model.requests[1]), [...CORE_TOOLS, "beta_read", "beta_danger"]);
  assert.ok(model.requests[1].system.includes("beta 使用提示"));
  assert.deepEqual(response.toolCalls.map((call) => call.name), ["beta_read"]);
  assert.deepEqual(beta.executed.map((call) => call.args), [{ q: 1 }]);
  assert.equal(response.content, "完成");
});

test("calling a module tool directly activates that module", async () => {
  const beta = fakePlugin("beta", /贝塔/);
  const model = scriptedModel(toolUse(["beta_read"]), text("好了"));
  const response = await setup([beta.plugin], model).assistant.handleChat([ask("随便看看")], {});
  assert.equal(beta.executed.length, 1);
  assert.ok(toolNames(model.requests[1]).includes("beta_read"));
  assert.deepEqual(response.toolCalls, [{ name: "beta_read", module: "beta", label: "读取", args: {}, result: { done: "beta_read" } }]);
});

test("unknown tools and modules return errors without recording tool calls", async () => {
  const model = scriptedModel(toolUse(["toString"], ["load_module_tools", { module: "constructor" }]), text(""));
  const response = await setup([fakePlugin("alpha", /阿尔法/).plugin], model).assistant.handleChat([ask("hi")], {});
  assert.deepEqual(toolResults(model.requests[1]), [{ error: "未知工具：toString" }, { error: "未知模块：constructor" }]);
  assert.deepEqual(response.toolCalls, []);
  assert.equal(response.content, "抱歉，这次没有生成回复，请换个说法再试一次。");
});

test("confirm tools wait for the user and run exactly once after confirmation", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/);
  const model = scriptedModel(toolUse(["alpha_danger", { id: "x1" }]), text("请点击确认"));
  const { assistant } = setup([alpha.plugin], model);
  const ctx = { journalToken: "token-for-confirmation-1234" };
  const response = await assistant.handleChat([ask("阿尔法危险操作")], ctx);

  assert.equal(alpha.executed.length, 0);
  assert.deepEqual(alpha.prepared.map((call) => call.args), [{ id: "x1" }]);
  const confirmation = response.toolCalls[0].confirmation;
  assert.ok(confirmation);
  assert.match(confirmation.actionId, /^[0-9a-f-]{36}$/);
  assert.equal(confirmation.summary, "确认执行 alpha_danger");
  assert.deepEqual(toolResults(model.requests[1]), [
    { status: "awaiting_user_confirmation", summary: "确认执行 alpha_danger", note: "已生成确认卡片，用户点击确认后才会执行" },
  ]);

  assert.deepEqual(await assistant.confirmAction(confirmation.actionId, ctx), { summary: "确认执行 alpha_danger", result: { done: "alpha_danger" } });
  assert.deepEqual(alpha.executed, [{ tool: "alpha_danger", args: { id: "x1" }, ctx }]);
  assert.equal(await assistant.confirmAction(confirmation.actionId, ctx), null);
  assert.equal(alpha.executed.length, 1);
});

test("cancelled confirmations can no longer run", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/);
  const { assistant } = setup([alpha.plugin], scriptedModel(toolUse(["alpha_danger"]), text("请确认")));
  const response = await assistant.handleChat([ask("阿尔法")], {});
  const id = response.toolCalls[0].confirmation?.actionId ?? "";
  assert.equal(assistant.cancelAction(id), true);
  assert.equal(assistant.cancelAction(id), false);
  assert.equal(await assistant.confirmAction(id, {}), null);
  assert.equal(alpha.executed.length, 0);
});

test("prepare can answer directly without creating a confirmation", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/, { prepare: async () => ({ result: { unchanged: true } }) });
  const model = scriptedModel(toolUse(["alpha_danger"]), text("已经是这个状态了"));
  const response = await setup([alpha.plugin], model).assistant.handleChat([ask("阿尔法")], {});
  assert.equal(response.toolCalls[0].confirmation, undefined);
  assert.deepEqual(response.toolCalls[0].result, { unchanged: true });
  assert.deepEqual(toolResults(model.requests[1]), [{ unchanged: true }]);
  assert.equal(alpha.executed.length, 0);
});

test("confirm tools without prepare fall back to the tool label as the summary", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/, { prepare: undefined });
  const response = await setup([alpha.plugin], scriptedModel(toolUse(["alpha_danger"]), text("请确认"))).assistant.handleChat([ask("阿尔法")], {});
  assert.equal(response.toolCalls[0].confirmation?.summary, "危险操作");
  assert.equal(alpha.executed.length, 0);
});

test("the journal token reaches plugins but never the model or the response", async () => {
  const token = "journal-token-should-stay-local-0001";
  const journal = fakePlugin("journal", /随手记/, { sensitive: true });
  const model = scriptedModel(toolUse(["journal_read"], ["journal_danger"]), text("好的"));
  const response = await setup([journal.plugin], model).assistant.handleChat([ask("看看随手记")], { journalToken: token });
  assert.equal(journal.executed[0].ctx.journalToken, token);
  assert.equal(journal.prepared[0].ctx.journalToken, token);
  assert.ok(!JSON.stringify(model.requests).includes(token));
  assert.ok(!JSON.stringify(response).includes(token));
});

test("responses flag sensitive modules and locked journals only when their tools ran", async () => {
  const journal = fakePlugin("journal", /随手记/, { sensitive: true, execute: async () => ({ journalLocked: true, message: "已锁定" }) });
  const locked = await setup([journal.plugin], scriptedModel(toolUse(["journal_read"]), text("请先解锁"))).assistant.handleChat([ask("看看随手记")], {});
  assert.equal(locked.journalLocked, true);
  assert.equal(locked.sensitive, true);

  const idle = await setup([journal.plugin], scriptedModel(text("你想记什么？"))).assistant.handleChat([ask("随手记")], {});
  assert.equal(idle.sensitive, undefined);
  assert.equal(idle.journalLocked, undefined);
});

test("plugin failures become tool errors instead of failing the chat", async () => {
  const boom = async (): Promise<never> => {
    throw new Error("boom");
  };
  const alpha = fakePlugin("alpha", /阿尔法/, { execute: boom, prepare: boom });
  const model = scriptedModel(toolUse(["alpha_read"], ["alpha_danger"]), text("出错了"));
  const { assistant, pending } = setup([alpha.plugin], model);
  const response = await assistant.handleChat([ask("阿尔法")], {});
  assert.deepEqual(toolResults(model.requests[1]), [{ error: "ALPHA模块执行失败：boom" }, { error: "ALPHA模块执行失败：boom" }]);
  assert.equal(response.content, "出错了");

  const action = pending.create({ plugin: "alpha", tool: "alpha_danger", args: {}, summary: "危险" });
  assert.deepEqual(await assistant.confirmAction(action.id, {}), { summary: "危险", result: { error: "ALPHA模块执行失败：boom" } });
});

test("the tool loop stops after maxSteps with an explanation", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/);
  const model = scriptedModel(toolUse(["alpha_read"]));
  const response = await setup([alpha.plugin], model, { maxSteps: 3 }).assistant.handleChat([ask("阿尔法")], {});
  assert.equal(model.requests.length, 3);
  assert.equal(alpha.executed.length, 3);
  assert.equal(response.content, "这次需要的步骤太多，已经执行了 3 个操作（见上方记录），请把需求拆小一点再试。");
});

test("open_module navigates only to whitelisted pages", async () => {
  const cases: [Record<string, unknown>, string | undefined, unknown][] = [
    [{ module: "tools", page: "timer-history" }, "/tools?page=timer-history", { opened: true, page: "工具 · 执行历史" }],
    [{ module: "tools", page: "pet" }, "/tools?page=pet", { opened: true, page: "工具 · 桌面灵宠" }],
    [{ module: "tools", page: "constructor" }, "/tools", { opened: true, page: "工具" }],
    [{ module: "music", page: "timer" }, "/music", { opened: true, page: "音乐" }],
    [{ module: "constructor" }, undefined, { error: "不支持打开这个页面" }],
  ];
  for (const [args, navigate, result] of cases) {
    const response = await setup([], scriptedModel(toolUse(["open_module", args]), text(""))).assistant.handleChat([ask("打开")], {});
    assert.equal(response.navigate, navigate);
    assert.deepEqual(response.toolCalls, [{ name: "open_module", label: "打开页面", args, result }]);
    assert.equal(response.content, "操作已完成。");
  }
});

test("history drops leading assistant turns, blank messages and merges consecutive roles", async () => {
  const model = scriptedModel(text("好"));
  await setup([], model).assistant.handleChat([answer("你好，我是助手"), ask("a"), ask("b"), answer("c"), answer("d"), ask("   "), ask("e")], {});
  assert.deepEqual(model.requests[0].messages, [
    { role: "user", content: "a\n\nb" },
    { role: "assistant", content: "c\n\nd" },
    { role: "user", content: "e" },
  ]);
});

test("assistant turns are replayed unchanged and all tool results share one user turn", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/);
  const thinking = { type: "thinking", thinking: "先查一下", signature: "sig" } as DeepSeekContentBlock;
  const first: DeepSeekResponse = { stop_reason: "tool_use", content: [thinking, ...toolUse(["alpha_read", { n: 1 }], ["alpha_read", { n: 2 }]).content] };
  const model = scriptedModel(first, text("好了"));
  await setup([alpha.plugin], model).assistant.handleChat([ask("阿尔法")], {});
  const [, assistantTurn, resultTurn] = model.requests[1].messages;
  assert.deepEqual(assistantTurn, { role: "assistant", content: first.content });
  assert.deepEqual(resultTurn, {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "call-0", content: JSON.stringify({ done: "alpha_read" }) },
      { type: "tool_result", tool_use_id: "call-1", content: JSON.stringify({ done: "alpha_read" }) },
    ],
  });
  assert.deepEqual(alpha.executed.map((call) => call.args), [{ n: 1 }, { n: 2 }]);
});

test("the model sees plain tool schemas, the module catalog, active module hints and local time", async () => {
  const model = scriptedModel(text("好"));
  await setup([fakePlugin("alpha", /阿尔法/).plugin, fakePlugin("beta", /贝塔/).plugin], model).assistant.handleChat([ask("阿尔法")], {});
  const [request] = model.requests;
  for (const tool of request.tools) assert.deepEqual(Object.keys(tool).sort(), ["description", "input_schema", "name"]);
  assert.equal(request.tools.find((tool) => tool.name === "alpha_read")?.description, "读取数据");
  assert.equal(request.tools.find((tool) => tool.name === "alpha_danger")?.description, "危险操作（调用后系统会生成确认卡片，用户点击确认后才会真正执行）");
  assert.ok(request.system.includes("- ALPHA（alpha）：alpha 的能力\n- BETA（beta）：beta 的能力"));
  assert.ok(request.system.includes("alpha 使用提示"));
  assert.ok(!request.system.includes("beta 使用提示"));
  assert.ok(request.system.endsWith("当前时间：2026-10-13 周二 09:05"));
});

test("oversized tool results are truncated before reaching the model", async () => {
  const alpha = fakePlugin("alpha", /阿尔法/, { execute: async () => "x".repeat(30_000) });
  const model = scriptedModel(toolUse(["alpha_read"]), text("好"));
  await setup([alpha.plugin], model).assistant.handleChat([ask("阿尔法")], {});
  const [content] = rawResults(model.requests[1]);
  const suffix = "…（结果过长，已截断）";
  assert.equal(content.length, 24_000 + suffix.length);
  assert.ok(content.endsWith(suffix));
});

test("pending actions expire after the TTL and evict the oldest entry when full", () => {
  let clock = 0;
  const store = createPendingActionStore({ ttlMs: 1_000, maxEntries: 2, now: () => clock });
  const input = { plugin: "p", tool: "t", args: {}, summary: "s" };
  const first = store.create(input);
  const second = store.create(input);
  const third = store.create(input);
  assert.equal(store.take(first.id), undefined);
  assert.equal(store.take(second.id)?.id, second.id);
  assert.equal(store.take(second.id), undefined);

  clock = 999;
  assert.equal(store.take(third.id)?.expiresAt, 1_000);
  const late = store.create(input);
  clock = 1_999;
  assert.equal(store.take(late.id), undefined);
});
