import assert from "node:assert/strict";
import test from "node:test";
import { createYunxiaoTask, getYunxiaoContext, resolveApiLocation } from "./yunxiao.js";

const connection = {
  address: "https://devops.aliyun.com/organization/org123/projects",
  requirementId: "req123",
  token: "pt-test-token",
};

test("云效地址只允许官方 HTTPS 接入点", () => {
  assert.deepEqual(resolveApiLocation(connection.address), {
    origin: "https://openapi-rdc.aliyuncs.com",
    prefix: "/oapi/v1/projex/organizations/org123",
    organizationId: "org123",
  });
  assert.throws(() => resolveApiLocation("http://127.0.0.1/organization/org123"));
  assert.throws(() => resolveApiLocation("https://example.com/organization/org123"));
});

test("创建任务关联需求并登记预计工时", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    requests.push({ url, method, body });
    let data: unknown;
    if (url.endsWith("/workitems/req123")) {
      data = { id: "req123", subject: "登录需求", categoryId: "Req",
        space: { id: "project123", name: "项目" }, assignedTo: { id: "user123", name: "负责人" } };
    } else if (url.includes("/workitemTypes?category=Task")) {
      data = [{ id: "type123", name: "开发任务", categoryId: "Task", enable: true, defaultType: true }];
    } else if (url.endsWith("/workitemTypes/type123/fields")) {
      data = [{ id: "priority", name: "优先级", type: "CustomField", required: true }];
    } else if (url.endsWith("/workitems") && method === "POST") {
      data = { id: "created123" };
    } else if (url.endsWith("/workitems/created123/estimatedEfforts")) {
      data = { id: "effort123" };
    } else {
      throw new Error(`Unexpected request: ${url}`);
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const context = await getYunxiaoContext(connection);
    assert.equal(context.requirement.projectId, "project123");
    const result = await createYunxiaoTask(connection, {
      projectId: "project123", taskTypeId: "type123", assigneeId: "user123",
      customFieldValues: { priority: "normal" },
      task: { subject: "完成登录页", description: "实现错误提示", estimatedHours: 3,
        estimateBasis: "explicit" },
    });
    assert.deepEqual(result, { id: "created123", effortSaved: true });
    const createRequest = requests.find((request) => request.method === "POST" && request.url.endsWith("/workitems"));
    assert.equal(createRequest?.body?.parentId, "req123");
    assert.equal(createRequest?.body?.spaceId, "project123");
    const effortRequest = requests.find((request) => request.url.endsWith("/estimatedEfforts"));
    assert.equal(effortRequest?.body?.spentTime, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("工时登记失败仍返回已创建任务 ID", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/workitems/req123")) {
      return Response.json({ id: "req123", subject: "需求", categoryId: "Req",
        space: { id: "project123" }, assignedTo: { id: "user123" } });
    }
    if (url.includes("/workitemTypes?category=Task")) {
      return Response.json([{ id: "type123", name: "任务", categoryId: "Task" }]);
    }
    if (url.endsWith("/workitemTypes/type123/fields")) return Response.json([]);
    if (url.endsWith("/workitems")) return Response.json({ id: "created123" });
    if (url.endsWith("/estimatedEfforts")) return Response.json({ error: "failed" }, { status: 500 });
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    const result = await createYunxiaoTask(connection, {
      projectId: "project123", taskTypeId: "type123", assigneeId: "user123",
      customFieldValues: {},
      task: { subject: "完成登录页", description: "实现错误提示", estimatedHours: 3,
        estimateBasis: "inferred" },
    });
    assert.equal(result.id, "created123");
    assert.equal(result.effortSaved, false);
    assert.match(result.warning ?? "", /勿重复创建/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
