import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type { Timer } from "../types/timer.js";

const directory = mkdtempSync(path.join(tmpdir(), "desktop-pet-"));
process.env.VAULT_FILE = path.join(directory, "test.vault");
after(() => rmSync(directory, { recursive: true, force: true }));

const vault = await import("../vault.js");
const storage = await import("./petStorage.js");
const timerStorage = await import("./storage.js");
const scheduler = await import("./scheduler.js");
const { petRouter } = await import("../routes/pet.js");
const { default: express } = await import("express");

await vault.unlockVault("pet-test-password");

test("灵宠设置、位置和互动数据写入加密仓库", async () => {
  const initial = await storage.getDesktopPetData();
  assert.equal(initial.settings.activePetId, "mist-cat");
  assert.equal(initial.settings.enabled, false);

  const enabled = await storage.updatePetSettings({ enabled: true, customName: "雪团", scale: 1.2 });
  assert.equal(enabled.settings.customName, "雪团");
  assert.equal(enabled.settings.scale, 1.2);

  const origin = await storage.updatePetPosition({ x: 0, y: 0 });
  assert.deepEqual(origin.position, { x: 0, y: 0 });
  const positioned = await storage.updatePetPosition({ x: 0.2, y: 0.7 });
  assert.deepEqual(positioned.position, { x: 0.2, y: 0.7 });

  const first = await storage.recordPetInteraction("pet", new Date("2026-10-27T10:00:00.000Z"));
  const second = await storage.recordPetInteraction("pet", new Date("2026-10-27T10:00:10.000Z"));
  const third = await storage.recordPetInteraction("play", new Date("2026-10-27T10:00:31.000Z"));
  assert.equal(first.rewarded, true);
  assert.equal(second.rewarded, false);
  assert.equal(third.rewarded, true);
  assert.equal(third.data.care["mist-cat"].affection, 3);
  assert.equal(third.data.care["mist-cat"].totalInteractions, 3);

  const raw = await vault.readVault();
  assert.equal(raw.desktopPets?.settings.customName, "雪团");
});

test("定时任务实际失败时记录失败状态", async () => {
  const timer: Timer = {
    id: "pet-event-failure-test",
    name: "灵宠失败联动验收",
    description: "",
    cronExpression: "0 0 1 1 *",
    taskType: "shell-command",
    taskConfig: { command: "node -e \"process.exit(2)\"", timeoutMs: 5_000 },
    enabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await scheduler.triggerTimer(timer);
  const record = (await timerStorage.getAllHistory()).find((item) => item.timerId === timer.id);
  assert.equal(record?.status, "failed");
  assert.equal(record?.error, "命令退出码 2");
});

test("灵宠 API 校验输入并拒绝未开放角色", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api/pets", petRouter);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/pets`;

  const catalogResponse = await fetch(base);
  assert.equal(catalogResponse.status, 200);
  const catalogBody = await catalogResponse.json() as { catalog: Array<{ id: string; available: boolean }> };
  assert.equal(catalogBody.catalog.length, 6);
  assert.equal(catalogBody.catalog.find((pet) => pet.id === "mist-cat")?.available, true);
  assert.equal(catalogBody.catalog.every((pet) => pet.available), true);

  const invalid = await fetch(`${base}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scale: 3 }),
  });
  assert.equal(invalid.status, 400);

  const unknown = await fetch(`${base}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activePetId: "unknown-pet" }),
  });
  assert.equal(unknown.status, 409);

  const careBeforeInvalidDelete = (await storage.getDesktopPetData()).care["mist-cat"];
  const invalidDelete = await fetch(`${base}/custom/mist-cat`, { method: "DELETE" });
  assert.equal(invalidDelete.status, 404);
  assert.deepEqual((await storage.getDesktopPetData()).care["mist-cat"], careBeforeInvalidDelete);

  const invalidAsset = await fetch(`${base}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "错误资源",
      personality: "测试",
      description: "",
      asset: {
        mode: "animated-image",
        mimeType: "image/png",
        imageDataUrl: "data:image/png;base64,aW52YWxpZA==",
        referenceDataUrls: [],
        width: 1,
        height: 1,
        backgroundRemoved: false,
      },
    }),
  });
  assert.equal(invalidAsset.status, 400);

  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const mismatchedDimensions = await fetch(`${base}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "错误尺寸",
      personality: "测试",
      description: "",
      asset: {
        mode: "static",
        mimeType: "image/png",
        imageDataUrl: pixel,
        referenceDataUrls: [],
        width: 2,
        height: 1,
        backgroundRemoved: true,
      },
    }),
  });
  assert.equal(mismatchedDimensions.status, 400);

  const spriteWithoutLayout = await fetch(`${base}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "错误图集",
      personality: "测试",
      description: "",
      asset: {
        mode: "sprite",
        mimeType: "image/png",
        imageDataUrl: pixel,
        referenceDataUrls: [],
        width: 1,
        height: 1,
        backgroundRemoved: true,
      },
    }),
  });
  assert.equal(spriteWithoutLayout.status, 400);

  const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
  const animated = await fetch(`${base}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "动画伙伴",
      personality: "活泼",
      description: "GIF 测试",
      asset: {
        mode: "animated-image",
        mimeType: "image/gif",
        imageDataUrl: gif,
        referenceDataUrls: [],
        width: 1,
        height: 1,
        backgroundRemoved: false,
      },
    }),
  });
  assert.equal(animated.status, 201);
  const animatedId = ((await animated.json()) as { pet: { id: string } }).pet.id;
  assert.equal((await fetch(`${base}/custom/${animatedId}`, { method: "DELETE" })).status, 200);

  const sprite = await fetch(`${base}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "图集伙伴",
      personality: "灵动",
      description: "Sprite 测试",
      asset: {
        mode: "sprite",
        mimeType: "image/png",
        imageDataUrl: pixel,
        referenceDataUrls: [],
        width: 1,
        height: 1,
        backgroundRemoved: true,
        animation: { columns: 1, rows: 1, fps: 8, actionRows: false, frameCount: 1 },
      },
    }),
  });
  assert.equal(sprite.status, 201);
  const spriteBody = (await sprite.json()) as { pet: { id: string; asset: { animation: { frameCount?: number } } } };
  assert.equal(spriteBody.pet.asset.animation.frameCount, 1);
  assert.equal((await fetch(`${base}/custom/${spriteBody.pet.id}`, { method: "DELETE" })).status, 200);

  const created = await fetch(`${base}/custom`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "测试伙伴",
      personality: "安静",
      description: "隔离测试",
      asset: {
        mode: "static",
        mimeType: "image/png",
        imageDataUrl: pixel,
        referenceDataUrls: [],
        width: 1,
        height: 1,
        backgroundRemoved: true,
      },
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json() as { pet: { id: string }; state: { customPets: Array<{ asset: Record<string, unknown> }> } };
  assert.equal(createdBody.state.customPets.length, 1);
  assert.equal("imageDataUrl" in createdBody.state.customPets[0].asset, false);

  const assetResponse = await fetch(`${base}/custom/${createdBody.pet.id}/asset`);
  assert.equal(assetResponse.status, 200);
  assert.equal(((await assetResponse.json()) as { asset: { imageDataUrl: string } }).asset.imageDataUrl, pixel);

  const activated = await fetch(`${base}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activePetId: createdBody.pet.id, customName: "测试伙伴" }),
  });
  assert.equal(activated.status, 200);

  const updated = await fetch(`${base}/custom/${createdBody.pet.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "改名伙伴",
      personality: "安静",
      description: "隔离测试",
      asset: {
        mode: "static",
        mimeType: "image/png",
        imageDataUrl: pixel,
        referenceDataUrls: [],
        width: 1,
        height: 1,
        backgroundRemoved: true,
      },
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(((await updated.json()) as { state: { settings: { customName: string } } }).state.settings.customName, "改名伙伴");

  const deleted = await fetch(`${base}/custom/${createdBody.pet.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.equal(((await deleted.json()) as { state: { settings: { activePetId: string } } }).state.settings.activePetId, "mist-cat");
});
