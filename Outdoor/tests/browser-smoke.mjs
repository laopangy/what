// Run with PLAYWRIGHT_MODULE_PATH set to a local Playwright installation.
// All API traffic is mocked: never unlock or mutate the actual user's vault.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { buildJourney } from "../server/dist/journeyPlanner.js";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const output = process.env.OUTDOOR_SCREENSHOTS;
if (output) await mkdir(output, {recursive: true});
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const point = (id, name, longitude) => ({id,name,address:"交互测试数据，不是真实目的地",location:[longitude,30],citycode:"0571",adcode:"330100",photos:[]});
const start = point("test-origin", "测试起点",120);
const destination = point("test-park", "测试公园",120.1);
const hotel = point("test-hotel", "测试酒店",120.12);
let saved = [];
let generationCount = 0;
await page.route("**/api/outdoor/**", async route => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname.replace("/api/outdoor","");
  const input = request.method() === "GET" ? null : request.postDataJSON();
  let body; let status = 200;
  if (pathname === "/map/status") body = {ready:false,jsReady:false,serviceReady:false};
  else if (pathname === "/settings") body = {homeAddress:""};
  else if (pathname === "/plans") body = [];
  else if (pathname === "/places") body = input.type === "hotel" ? [hotel] : [input.query.includes("起点") ? start : destination];
  else if (pathname === "/recommend") body = input.mode === "cycling" ? {
    candidates:[8,18,28].map((km,index) => {
      const place=point("ride-"+index,"测试骑行终点"+index,120.1+index/100);
      const leg={from:start,to:place,mode:"cycling",minutes:30,km,paths:[[start.location,place.location]],instructions:["测试道路"],queriedAt:new Date().toISOString(),source:"amap"};
      return {place,outbound:leg,returnRoute:{...leg,from:place,to:start}};
    }),note:"测试公路车候选"
  } : {candidates:[],note:"测试：没有匹配的候选，请调整条件"};
  else if (pathname === "/journeys/generate") {
    generationCount++;
    try {
      body = await buildJourney(input,{route:async (from,to,mode) => ({
        from,to,mode,minutes:30,km:5,paths:[[from.location,to.location]],instructions:["测试路段"],queriedAt:new Date().toISOString(),source:"amap",
      })});
    } catch (error) { status=400; body={success:false,error:error.message}; }
  } else if (pathname === "/journeys" && request.method() === "POST") {
    body={...input,saved:true}; saved=[body,...saved.filter(p=>p.id!==body.id)];
  } else if (/^\/journeys\/[^/]+\/calendar$/.test(pathname)) body={success:true,count:saved[0].events.length,calendarName:"测试行程日历",lastSyncedAt:new Date().toISOString()};
  else if (pathname === "/journeys") body=saved;
  else if (pathname.startsWith("/journeys/") && request.method() === "DELETE") {saved=saved.filter(p=>p.id!==pathname.split("/").at(-1));body={success:true};}
  else {status=503;body={success:false,error:"测试环境未配置地图"};}
  await route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
});
try {
  await page.goto("http://127.0.0.1:5177");
  await page.getByRole("heading",{name:"先定好时间，再决定走多远"}).waitFor();
  assert.equal(await page.getByRole("textbox",{name:"成年人（不含老人）",exact:true}).count(),0);
  await page.getByLabel("添加同行人员类别").selectOption("adults");
  assert.equal(await page.getByRole("textbox",{name:"成年人（不含老人）",exact:true}).inputValue(),"");
  await page.getByRole("textbox",{name:"成年人（不含老人）",exact:true}).fill("2");
  await page.getByRole("button",{name:"移除成年人（不含老人）",exact:true}).click();
  assert.equal(await page.getByRole("textbox",{name:"成年人（不含老人）",exact:true}).count(),0);
  await page.getByLabel("添加同行人员类别").selectOption("adults");
  await page.getByRole("textbox",{name:"成年人（不含老人）",exact:true}).fill("2");
  if (output) await page.screenshot({path:path.join(output,"outdoor-desktop.png"),fullPage:true});
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"请搜索并确认出发地"}).waitFor();
  await page.getByRole("textbox",{name:"从哪里出发",exact:true}).fill("测试起点");
  await page.getByRole("button",{name:"搜索从哪里出发",exact:true}).click();
  await page.getByRole("button",{name:/测试起点 交互测试/}).click();
  // Editing a confirmed search must retain the typed value rather than reverting to home.
  await page.getByRole("textbox",{name:"从哪里出发",exact:true}).fill("新的测试起点");
  assert.equal(await page.getByRole("textbox",{name:"从哪里出发",exact:true}).inputValue(),"新的测试起点");
  await page.getByRole("button",{name:"搜索从哪里出发",exact:true}).click();
  await page.getByRole("button",{name:/测试起点 交互测试/}).click();
  await page.getByLabel("出发日期",{exact:true}).fill("2026-09-12");
  await page.getByLabel("返程日期",{exact:true}).fill("2026-09-13");
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("heading",{name:"怎么去，到了之后怎么玩"}).waitFor();
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"帮我推荐",exact:true}).click();
  await page.getByText("测试：没有匹配的候选，请调整条件").waitFor();
  await page.getByRole("textbox",{name:"想去的目的地",exact:true}).fill("测试公园");
  await page.getByRole("button",{name:"搜索想去的目的地",exact:true}).click();
  await page.getByRole("button",{name:/测试公园 交互测试/}).click();
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"生成完整行程",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"请先确认酒店位置"}).waitFor();
  await page.getByRole("button",{name:"搜索目的地周边酒店",exact:true}).click();
  await page.getByRole("button",{name:/测试酒店 交互测试/}).click();
  await page.getByRole("button",{name:"生成完整行程",exact:true}).click();
  await page.getByRole("button",{name:"保存完整行程",exact:true}).waitFor();
  await page.getByRole("button",{name:"2 日 · 09-13",exact:true}).click();
  await page.getByRole("button").filter({hasText:"返程到家"}).click();
  await page.getByRole("heading",{name:"返程到家",exact:true}).waitFor();
  if (output) await page.screenshot({path:path.join(output,"outdoor-itinerary-test.png"),fullPage:true});
  await page.getByRole("button",{name:"保存完整行程",exact:true}).click();
  await page.getByRole("status").filter({hasText:"完整行程已加密保存"}).waitFor();
  await page.getByRole("button",{name:"同步到苹果日历",exact:true}).click();
  await page.getByRole("status").filter({hasText:"测试行程日历"}).waitFor();
  await page.getByRole("button",{name:/我的行程/}).click();
  await page.getByRole("button",{name:"查看行程",exact:true}).click();
  await page.getByRole("button",{name:"修改条件 / 重新计算",exact:true}).click();
  await page.getByRole("button",{name:/时间与范围/}).click();
  await page.getByRole("button",{name:"清除时间限制",exact:true}).click();
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"至少填写一项"}).waitFor();
  await page.getByRole("textbox",{name:"单程距离上限 / 公里",exact:true}).fill("50");
  await page.getByLabel("添加同行人员类别").selectOption("seniors");
  await page.getByRole("textbox",{name:"老人",exact:true}).fill("");
  assert.equal(await page.getByRole("textbox",{name:"老人",exact:true}).inputValue(),"");
  await page.getByRole("textbox",{name:"老人",exact:true}).pressSequentially("2");
  assert.equal(await page.getByRole("textbox",{name:"老人",exact:true}).inputValue(),"2");
  await page.getByRole("textbox",{name:"老人",exact:true}).fill("0");
  await page.getByRole("textbox",{name:"单程交通上限分钟",exact:true}).fill("15");
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"生成完整行程",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"超过单程时间或距离上限"}).waitFor();
  assert.equal(generationCount,2);
  const originalId = saved[0].id;
  await page.getByRole("button",{name:/时间与范围/}).click();
  await page.getByRole("textbox",{name:"单程交通上限小时",exact:true}).fill("2");
  for (let i=0; i<3; i++) await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"生成完整行程",exact:true}).click();
  await page.getByRole("button",{name:"保存完整行程",exact:true}).click();
  await page.getByRole("status").filter({hasText:"完整行程已加密保存"}).waitFor();
  assert.equal(saved.length,1);
  assert.equal(saved[0].id,originalId);
  await page.getByRole("button",{name:/我的行程/}).click();
  await page.getByRole("button",{name:"删除测试公园 · 2 日行程",exact:true}).click();
  await page.getByRole("button",{name:"确认删除",exact:true}).click();
  await page.getByRole("heading",{name:"还没有保存的行程"}).waitFor();
  await page.getByRole("button",{name:"开始规划",exact:true}).click();
  await page.getByRole("button",{name:/时间与范围/}).click();
  await page.getByLabel("返程日期",{exact:true}).fill("2026-09-12");
  await page.getByRole("textbox",{name:"单程交通上限小时",exact:true}).fill("2");
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"公路车骑行",exact:true}).click();
  await page.getByRole("textbox",{name:"骑行总里程上限 / 公里",exact:true}).fill("100");
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"帮我推荐",exact:true}).click();
  await page.getByRole("heading",{name:/10 公里内/}).waitFor();
  await page.getByRole("heading",{name:/10–20 公里/}).waitFor();
  await page.getByRole("heading",{name:/20–30 公里/}).waitFor();
  await page.getByRole("button").filter({hasText:"公路车往返 · 测试骑行终点0"}).click();
  await page.getByRole("button",{name:"下一步",exact:true}).click();
  await page.getByRole("button",{name:"生成完整行程",exact:true}).click();
  await page.getByRole("heading",{name:/公路车往返 · 测试骑行终点0/}).first().waitFor();
  assert.equal(await page.getByRole("button").filter({hasText:"游览与自由活动"}).count(),0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:/时间与范围/}).click();
  if (output) await page.screenshot({path:path.join(output,"outdoor-mobile.png"),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),"No horizontal overflow");
  assert.deepEqual(errors,[]);
  console.log("PASS: desktop/mobile, wizard, search editing, recommendations, hotel requirement, multi-day itinerary, save/reopen/delete, constraint recalculation.");
} finally { await browser.close(); }
