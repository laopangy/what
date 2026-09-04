import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Amap, coordinates, providerErrorMessage } from "./amap.js";
import { draftSchema, journeySchema } from "./journeySchema.js";
import { buildJourney, recommend, withinLimits } from "./journeyPlanner.js";
import type { Place, RouteLeg, TripDraft } from "./journeyTypes.js";
const place = (id: string, x: number): Place => ({id, name: id, address: "测试地址", location: [x, 30], citycode: "0571", adcode: "330100", photos: []});
const origin = place("origin", 120);
const destination = place("destination", 120.1);
const hotel = place("hotel", 120.12);
const draft: TripDraft = {origin, destination, startDate: "2026-09-12", endDate: "2026-09-12", startTime: "08:00", endTime: "20:00",
  maxMinutes: 120, maxKm: 100, people: 2, mode: "driving", activity: "leisure", activityMinutes: 120, activityKm: 10,
  dailyPlaces: [], activityEnd: null, lodging: "recommend", hotel: null, rooms: 1, hotelBudget: 400, hotelPreference: ""};
const mockRoute = async (from: Place, to: Place, mode: RouteLeg["mode"]): Promise<RouteLeg> => ({
  from, to, mode, minutes: from.id === to.id ? 0 : 30, km: from.id === to.id ? 0 : 2,
  paths: [[from.location, to.location]], instructions: ["测试路线"], queriedAt: new Date().toISOString(), source: "amap",
});
test("time or distance is required; traveler ages and optional women do not double-count", async () => {
  assert.equal(draftSchema.safeParse({...draft, maxMinutes:null, maxKm:null}).success, false);
  assert.equal(draftSchema.safeParse({...draft, maxMinutes:null, maxKm:50}).success, true);
  assert.equal(draftSchema.safeParse({...draft, maxMinutes:90, maxKm:null}).success, true);
  assert.equal(draftSchema.safeParse({...draft, people:4, travelers:{adults:2,seniors:1,children:1,women:2}}).success, true);
  assert.equal(draftSchema.safeParse({...draft, travelers:{adults:2,seniors:1,children:1,women:2}}).success, false);
  assert.equal(draftSchema.safeParse({...draft, travelers:{adults:2,seniors:0,children:0,women:3}}).success, false);
  const leg = await mockRoute(origin,destination,"driving");
  assert.equal(withinLimits({...leg,minutes:500}, {...draft,maxMinutes:null}), true);
  assert.equal(withinLimits({...leg,km:500}, {...draft,maxKm:null}), true);
  assert.equal(withinLimits({...leg,km:500}, {...draft,maxMinutes:null}), false);
  const plan = await buildJourney({...draft,maxMinutes:null}, {route:mockRoute});
  assert.equal(plan.events.at(-1)?.kind,"return");
});
test("AMap 10021 retries finitely and concurrent identical requests share one request", async () => {
  let calls = 0;
  const provider = new Amap("rate-test-key", async () => {
    calls++;
    return calls === 1 ? response({status:"0",infocode:"10021"}) : response({status:"1",pois:[]});
  });
  await Promise.all([provider.search("test"),provider.search("test")]);
  assert.equal(calls,2);
  let failedCalls=0;
  const limited = new Amap("always-rate-test",async () => {failedCalls++;return response({status:"0",infocode:"10021"});});
  await assert.rejects(limited.search("test"), /QPS 超限/);
  assert.equal(failedCalls,3);
  assert.match(providerErrorMessage("10003"),/当日调用额度/);
  assert.ok(!providerErrorMessage("10021").includes("Key 类型"));
});
test("schema rejects invalid calendar dates, end dates and negative limits", () => {
  assert.equal(draftSchema.safeParse({...draft, startDate: "2026-02-30"}).success, false);
  assert.equal(draftSchema.safeParse({...draft, endDate: "2026-09-11"}).success, false);
  assert.equal(draftSchema.safeParse({...draft, endDate: "2026-09-20"}).success, false);
  assert.equal(draftSchema.safeParse({...draft, startTime: "25:00"}).success, false);
  assert.equal(draftSchema.safeParse({...draft, maxKm: -1}).success, false);
});
test("same-day journey is continuous, returns home and validates for persistence", async () => {
  const plan = await buildJourney(draft, {route: mockRoute});
  assert.equal(plan.events.at(-1)?.place.id, origin.id);
  assert.equal(plan.events.at(-1)?.kind, "return");
  for (let i = 1; i < plan.events.length; i++) assert.equal(plan.events[i].start, plan.events[i-1].end);
  assert.equal(plan.events.some(e => e.kind === "hotel"), false);
  assert.equal(journeySchema.safeParse(plan).success, true);
});
test("multi-day plan uses hotel overnight and preserves concrete dates", async () => {
  const plan = await buildJourney({...draft, endDate: "2026-09-14", hotel}, {route: mockRoute});
  assert.deepEqual([...new Set(plan.events.map(e => e.day))], ["2026-09-12", "2026-09-13", "2026-09-14"]);
  assert.equal(plan.events.filter(e => e.title.startsWith("入住")).length, 2);
  assert.equal(plan.events.find(e => e.day === "2026-09-13")?.place.id, hotel.id);
  assert.equal(plan.events.at(-1)?.place.id, origin.id);
});
test("missing accommodation, impossible time, outbound and return limits all block generation", async () => {
  await assert.rejects(buildJourney({...draft, endDate: "2026-09-13"}, {route: mockRoute}), /住宿/);
  await assert.rejects(buildJourney({...draft, endDate: "2026-09-13", hotel, lodging: "later"}, {route: mockRoute}), /住宿/);
  await assert.rejects(buildJourney({...draft, endTime: "09:00"}, {route: mockRoute}), /时间不足/);
  await assert.rejects(buildJourney({...draft, maxMinutes: 20}, {route: mockRoute}), /上限/);
  await assert.rejects(buildJourney(draft, {route: async (a, b, m) => ({...await mockRoute(a,b,m), minutes: b.id === origin.id ? 121 : 30})}), /上限/);
});
test("cycling and hiking use actual activity routes and enforce round-trip limits", async () => {
  const input: TripDraft = {...draft, activity: "cycling", activityEnd: place("turnaround", 120.11)};
  const plan = await buildJourney(input, {route: mockRoute});
  assert.equal(plan.events.filter(e => e.leg?.mode === "cycling").length, 2);
  await assert.rejects(buildJourney({...input, activityKm: 3}, {route: mockRoute}), /活动往返超过/);
  await assert.rejects(buildJourney({...input, activityMinutes: 60}, {route: mockRoute}), /活动往返超过/);
  await assert.rejects(buildJourney({...input, activityEnd: null}, {route: mockRoute}), /折返点/);
  const hiking = await buildJourney({...input, activity: "hiking"}, {route: mockRoute});
  assert.equal(hiking.events.filter(e => e.leg?.mode === "walking").length, 2);
  assert.ok(hiking.warnings.some(w => w.includes("不是已核实的登山轨迹")));
});
function response(body: unknown) { return new Response(JSON.stringify(body), {status: 200, headers: {"Content-Type": "application/json"}}); }
test("AMap v5 parses cost duration and real polylines with correct credentials and transport", async () => {
  const provider = new Amap("test-key", async (url) => {
    assert.match(String(url), /v5\/direction\/bicycling/);
    assert.match(String(url), /show_fields=cost%2Cpolyline/);
    return response({status: "1", route: {paths: [{distance: "1250", cost: {duration: "301"}, steps: [{instruction: "向前", polyline: "120,30;120.1,30"}]}]}});
  });
  const route = await provider.route(origin, destination, "cycling", draft.startDate, "08:00");
  assert.equal(route.minutes, 6); assert.equal(route.km, 1.25); assert.equal(route.paths[0].length, 2);
  assert.deepEqual(coordinates("bad"), null);
  assert.deepEqual(coordinates("190,30"), null);
});
test("provider errors, missing durations and missing rail never fall back to fake routes", async () => {
  await assert.rejects(new Amap("").route(origin,destination,"driving",draft.startDate,"08:00"), /配置/);
  const bad = new Amap("key", async () => response({status: "0", info: "key=secret", infocode: "10001"}));
  await assert.rejects(bad.route(origin,destination,"driving",draft.startDate,"08:00"), error => {
    assert.ok(error instanceof Error); assert.ok(!error.message.includes("secret")); return true;
  });
  const incomplete = new Amap("key", async () => response({status: "1", route: {paths: [{distance: "100"}]}}));
  await assert.rejects(incomplete.route(origin,destination,"driving",draft.startDate,"08:00"), /缺少/);
  const busOnly = new Amap("key", async () => response({status: "1", route: {transits: [{distance: "100", cost: {duration:"60"}, segments: []}]}}));
  await assert.rejects(busOnly.route(origin,destination,"rail",draft.startDate,"08:00"), /未返回含铁路/);
});
test("recommendations filter actual outbound and return limits; no fixed destination", async () => {
  const provider = new Amap("key", async url => String(url).includes("/place/")
    ? response({status: "1", pois: [{id: "near", name: "测试公园", location: "120.1,30", citycode: "0571", adcode:"330100", photos: []}]})
    : response({status: "1", route: {paths: [{distance: "5000", cost: {duration: String(String(url).includes("origin=120.100000") ? 99999 : 600)}}]}}));
  const result = await recommend({...draft, destination:null, maxMinutes:60}, provider);
  assert.equal(result.candidates.length, 0);
});
test("new plans, keys and home settings coexist encrypted without touching the user's vault", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "outdoor-vault-test-"));
  process.env.VAULT_FILE = path.join(directory, "what.vault");
  try {
    const {unlockVault, readVault} = await import("./vault.js");
    const {saveJourney, readJourneys} = await import("./journeyStorage.js");
    const {saveSettings} = await import("./storage.js");
    const {saveCredentials, readCredentials} = await import("./mapSettings.js");
    await unlockVault("isolated-test-password");
    await saveCredentials({jsKey:"a".repeat(32),securityCode:"b".repeat(32),serviceKey:"c".repeat(32)});
    const plan = await buildJourney(draft, {route:mockRoute});
    await saveJourney(plan);
    await saveSettings({homeAddress:"private-home-test"});
    assert.equal((await readJourneys())[0].id, plan.id);
    assert.equal((await readCredentials())?.serviceKey, "c".repeat(32));
    assert.ok((await readVault()).outdoor);
    const raw = await readFile(process.env.VAULT_FILE, "utf8");
    assert.ok(!raw.includes("private-home-test") && !raw.includes(plan.id) && !raw.includes("c".repeat(32)));
  } finally {
    // Exact directory returned by mkdtemp; never remove a user workspace or actual vault.
    await rm(directory, {recursive: true, force: true});
  }
});
