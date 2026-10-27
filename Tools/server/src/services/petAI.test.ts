import assert from "node:assert/strict";
import test from "node:test";
import { callPetDialogue } from "./petAI.js";

const input = {
  petName: "雾团",
  personality: "慵懒、好奇",
  currentAction: "idle",
  mood: 72,
  message: "你在做什么？",
  history: Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 === 0 ? "user" as const : "assistant" as const,
    text: `消息${index}`,
  })),
};

test("未配置 AI 时不返回本地伪回复", async () => {
  await assert.rejects(() => callPetDialogue(input, {
    config: { token: "", baseUrl: "https://example.invalid", model: "test" },
  }), /未配置/);
});

test("灵宠对话只发送有限历史和角色状态", async () => {
  let requestBody: Record<string, unknown> | undefined;
  const reply = await callPetDialogue(input, {
    config: { token: "secret-token", baseUrl: "https://example.invalid/", model: "test-model" },
    fetchImpl: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      assert.equal((init?.headers as Record<string, string>)["x-api-key"], "secret-token");
      return Response.json({ content: [{ type: "text", text: "刚刚观察了一会儿，现在来陪你。" }] });
    },
  });
  assert.equal(reply, "刚刚观察了一会儿，现在来陪你。");
  assert.equal(requestBody?.model, "test-model");
  const messages = requestBody?.messages as Array<{ role: string; content: string }>;
  assert.equal(messages.length, 9);
  assert.equal(messages.at(-1)?.content, input.message);
  assert.doesNotMatch(JSON.stringify(requestBody), /secret-token/);
});

test("灵宠回复最多保留 60 个字符", async () => {
  const reply = await callPetDialogue(input, {
    config: { token: "secret-token", baseUrl: "https://example.invalid", model: "test-model" },
    fetchImpl: async () => Response.json({ content: [{ type: "text", text: "好".repeat(80) }] }),
  });
  assert.equal(Array.from(reply).length, 60);
});
