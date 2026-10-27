import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const directory = mkdtempSync(path.join(tmpdir(), "desktop-pet-"));
process.env.VAULT_FILE = path.join(directory, "test.vault");
after(() => rmSync(directory, { recursive: true, force: true }));

const vault = await import("../vault.js");
const storage = await import("./petStorage.js");
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

  const invalid = await fetch(`${base}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scale: 3 }),
  });
  assert.equal(invalid.status, 400);

  const unavailable = await fetch(`${base}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activePetId: "sunny-dog" }),
  });
  assert.equal(unavailable.status, 409);
});
