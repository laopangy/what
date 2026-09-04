import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { calendarEvent, calendarUid } from "./calendarEvents.js";
import { appleUrl, calendarHash, connectApple, createAppleFetch, type CalendarRemote, type RemoteEvent } from "./icloudClient.js";
import type { Journey } from "./journeyTypes.js";

const place = {id: "place", name: "私人住址", address: "测试地址，单元;楼层\n换行", location: [120, 30] as [number, number], citycode: "0571", adcode: "330100", photos: []};
const journey: Journey = {id: "a90d84b0-060e-4d08-ad5e-b8ed3f1ea920", version: 2, title: "出行测试", createdAt: "2026-09-04T00:00:00Z", saved: true,
  draft: {origin: place, destination: place, startDate: "2026-09-04", endDate: "2026-09-04", startTime: "08:00", endTime: "20:00", maxMinutes: 120, maxKm: null, people: 2, mode: "driving", activity: "leisure", activityMinutes: 120, activityKm: 10, dailyPlaces: [], activityEnd: null, lodging: "later", hotel: null, rooms: 1, hotelBudget: 400, hotelPreference: ""},
  events: [0, 1, 2].map(index => ({id: `event-${index}`, day: "2026-09-04", start: `0${index + 8}:00`.replace("010", "10"), end: `0${index + 8}:30`.replace("010", "10"), title: `活动 ${index}`, kind: "activity", note: "中文内容".repeat(40), place})), warnings: ["计划时间需核实"]};

test("iCalendar preserves private details, escapes text, folds UTF-8 and uses Beijing times", () => {
  const result = calendarEvent(journey, journey.events[0], 0, 15);
  const unfolded = result.replace(/\r\n /g, "");
  assert.match(unfolded, /DTSTART:20260904T000000Z/);
  assert.match(unfolded, /DTEND:20260904T003000Z/);
  assert.ok(unfolded.includes("LOCATION:私人住址 · 测试地址，单元\\;楼层\\n换行"));
  assert.ok(unfolded.includes("中文内容".repeat(40)));
  assert.match(result, /TRIGGER:-PT15M/);
  assert.ok(result.split("\r\n").every(line => Buffer.byteLength(line) <= 75));
  assert.ok(!calendarEvent(journey, journey.events[0], 0, null).includes("VALARM"));
  assert.match(calendarEvent(journey, {...journey.events[0], end: "08:00"}, 0, 0), /DTEND:20260904T000100Z/);
});

test("credential transport rejects unsafe targets and redirects before forwarding", async () => {
  for (const url of ["http://caldav.icloud.com/", "https://caldav.icloud.com.evil.test/", "https://127.0.0.1/", "https://caldav.icloud.com:8443/"]) assert.throws(() => appleUrl(url));
  assert.equal(appleUrl("https://p42-caldav.icloud.com/calendar/").hostname, "p42-caldav.icloud.com");
  let requests = 0;
  const guarded = createAppleFetch(async () => { requests++; return new Response(null, {status: 302, headers: {location: "https://evil.test/"}}); });
  await assert.rejects(guarded("https://caldav.icloud.com/", {headers: {Authorization: "secret"}}));
  assert.equal(requests, 1);
  const denied = createAppleFetch(async () => new Response("secret-provider-response", {status: 401}));
  await assert.rejects(denied("https://caldav.icloud.com/"), error => error instanceof Error && error.message.includes("App 专用密码") && !error.message.includes("secret-provider"));
});

test("CalDAV discovery and object operations use Apple credentials and conditional requests", async () => {
  const root = "https://p42-caldav.icloud.com";
  const responseXml = (href: string, props: string) => new Response('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>' + href + '</d:href><d:propstat><d:prop>' + props + '</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>', {status:207, headers:{"Content-Type":"application/xml"}});
  const methods: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Basic " + Buffer.from("test@example.com:abcd-efgh-ijkl-mnop").toString("base64"));
    const method = init?.method || "GET";
    methods.push(method);
    if (url.includes(".well-known")) return new Response(null, {status:301,headers:{Location:root + "/"}});
    const body = String(init?.body || "");
    if (method === "PROPFIND") {
      if (body.includes("current-user-principal")) return responseXml("/", '<d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal>');
      if (body.includes("calendar-home-set")) return responseXml("/principal/", '<c:calendar-home-set><d:href>' + root + '/calendars/</d:href></c:calendar-home-set>');
      if (body.includes("supported-report-set")) return responseXml("/calendars/travel/", '<d:supported-report-set/>');
      return responseXml("/calendars/travel/", '<d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>旅行</d:displayname><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>');
    }
    assert.ok(url.startsWith(root));
    if (method === "GET") return new Response("calendar-data",{headers:{etag:'"1"'}});
    if (method === "PUT") {
      assert.equal(headers.get("Content-Type"),"text/calendar; charset=utf-8");
      assert.equal(headers.get("If-Match") || headers.get("If-None-Match"), headers.has("If-Match") ? '"1"' : "*");
      return new Response(null,{status:201});
    }
    if (method === "DELETE") { assert.equal(headers.get("If-Match"),'"1"'); return new Response(null,{status:204}); }
    throw new Error("Unexpected request");
  };
  const remote = await connectApple({username:"test@example.com",password:"abcd-efgh-ijkl-mnop"}, transport);
  const calendars = await remote.calendars();
  assert.equal(calendars[0].name,"旅行");
  assert.equal(calendars[0].url,root + "/calendars/travel/");
  const objectUrl = calendars[0].url + "event.ics";
  assert.deepEqual(await remote.get(objectUrl),{data:"calendar-data",etag:'"1"'});
  await remote.put(objectUrl,"ical");
  await remote.put(objectUrl,"ical",'"1"');
  await remote.remove(objectUrl,'"1"');
  assert.ok(methods.includes("PROPFIND") && methods.includes("DELETE"));
});

test("encrypted calendar connection, idempotent sync, retry, stale cleanup and disconnect", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "what-calendar-test-"));
  process.env.VAULT_FILE = path.join(dir, "what.vault");
  const {unlockVault} = await import("./vault.js");
  const {saveJourney} = await import("./journeyStorage.js");
  const {createCalendarService, appleCredentialsSchema} = await import("./icloudCalendar.js");
  const url = "https://p42-caldav.icloud.com/private/calendar/";
  const id = calendarHash(url);
  const records = new Map<string, RemoteEvent>();
  let failAt = -1;
  let writes = 0;
  const remote: CalendarRemote = {
    async calendars() { return [{id, name: "测试日历", url}]; },
    async get(key) { return records.get(key) || null; },
    async put(key, data, etag) {
      if (writes++ === failAt) throw new Error("模拟断网");
      assert.equal(etag, records.get(key)?.etag);
      records.set(key, {data, etag: String(writes)});
    },
    async remove(key, etag) { assert.equal(etag, records.get(key)?.etag); records.delete(key); },
  };
  const service = createCalendarService(async () => remote);
  try {
    await assert.rejects(service.status(), /尚未解锁/);
    await unlockVault("isolated-test-password");
    const credentials = {username: "private@example.com", password: "abcd-efgh-ijkl-mnop"};
    assert.equal(appleCredentialsSchema.safeParse({...credentials, password: "normal-password"}).success, false);
    const connected = await service.connect(credentials);
    assert.equal(connected.connected, true);
    assert.ok(!JSON.stringify(connected).includes(credentials.password));
    await assert.rejects(service.select({calendarId: "unknown", reminderMinutes: 15}), /请选择/);
    await assert.rejects(service.sync(journey.id), /选择目标日历/);
    await service.select({calendarId: id, reminderMinutes: 15});
    await saveJourney(journey);
    failAt = 1;
    await assert.rejects(service.sync(journey.id), /已写入 1\/3/);
    assert.equal(records.size, 1);
    failAt = -1;
    assert.equal((await service.sync(journey.id)).count, 3);
    assert.equal(records.size, 3);
    await service.sync(journey.id);
    assert.equal(records.size, 3);
    // Replanning changes event ids, but the same journey retains stable resource identities.
    await saveJourney({...journey, events: [{...journey.events[0], id: "new-event-id", title: "更新活动"}]});
    await service.sync(journey.id);
    assert.equal(records.size, 1);
    assert.match([...records.values()][0].data, /SUMMARY:更新活动/);
    const eventUrl = `${url}what-${journey.id}-0.ics`;
    records.set(eventUrl, {data: "BEGIN:VCALENDAR\r\nUID:unrelated\r\nEND:VCALENDAR", etag: "other"});
    await assert.rejects(service.sync(journey.id), /同名的其他日程/);
    assert.ok(!records.get(eventUrl)?.data.includes(calendarUid(journey.id, 0)));
    const encrypted = await readFile(process.env.VAULT_FILE, "utf8");
    for (const privateValue of [credentials.username, credentials.password, place.address, url]) assert.ok(!encrypted.includes(privateValue));
    await service.disconnect();
    assert.equal((await service.status()).connected, false);
    assert.equal(records.size, 1);
    await assert.rejects(service.sync(journey.id), /请先在账号与服务/);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
