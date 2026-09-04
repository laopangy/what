// Start the Music client on MUSIC_TEST_URL (default port 15173). All APIs are mocked.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})});
const page = await browser.newPage({viewport:{width:1280,height:1000}});
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.routeWebSocket("**/ws", socket => socket.close());
let status = {connected:false, username:"", calendarId:"", reminderMinutes:15, calendars:[]};
let failSave = true;
await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  let body = {success:false};
  let code = 200;
  if (path === "/api/settings/status") body = {success:true,data:{netease:{loggedIn:false},qq:{loggedIn:false},ai:{configured:false,provider:"deepseek",baseUrl:"https://api.deepseek.com/anthropic",model:"deepseek-v4-pro"}}};
  else if (path === "/api/outdoor/map/status") body = {ready:false,jsReady:false,serviceReady:false};
  else if (path.startsWith("/api/outdoor/calendar/")) {
    const action = path.split("/").at(-1);
    if (action === "connect") {
      const input = req.postDataJSON();
      assert.equal(input.password,"abcd-efgh-ijkl-mnop");
      status = {...status,connected:true,username:input.username,calendars:[{id:"a".repeat(64),name:"工具栈行程"}]};
    }
    if (action === "selection") {
      if (failSave) {failSave=false; code=500; body={success:false,error:"模拟连接中断，请重试"};}
      else status = {...status,...req.postDataJSON()};
    }
    if (action === "connection") status = {connected:false,username:"",calendarId:"",reminderMinutes:15,calendars:[]};
    if (code === 200) body=status;
  }
  await route.fulfill({status:code,contentType:"application/json",body:JSON.stringify(body)});
});
try {
  await page.goto((process.env.MUSIC_TEST_URL || "http://127.0.0.1:15173") + "/settings?embedded=1");
  const card = page.locator("section").filter({has:page.getByRole("heading",{name:"iCloud 日历",exact:true})});
  await card.getByLabel("Apple 账号",{exact:true}).fill("test@example.com");
  await card.getByLabel("App 专用密码",{exact:true}).fill("abcd-efgh-ijkl-mnop");
  assert.equal(await card.getByLabel("App 专用密码",{exact:true}).getAttribute("type"),"password");
  await card.getByRole("button",{name:"连接 iCloud",exact:true}).click();
  await card.getByText("已连接",{exact:true}).waitFor();
  assert.equal(await card.getByLabel("App 专用密码",{exact:true}).count(),0);
  assert.equal(await card.getByRole("button",{name:"保存日历设置"}).isDisabled(),true);
  await card.getByLabel("目标日历").selectOption("a".repeat(64));
  await card.getByLabel("活动提醒").selectOption("30");
  await card.getByRole("button",{name:"保存日历设置"}).click();
  await card.getByRole("alert").filter({hasText:"模拟连接中断"}).waitFor();
  await card.getByRole("button",{name:"保存日历设置"}).click();
  await card.getByRole("status").filter({hasText:"设置已保存"}).waitFor();
  assert.equal(status.reminderMinutes,30);
  if (process.env.CALENDAR_SCREENSHOT) await card.screenshot({path:process.env.CALENDAR_SCREENSHOT});
  await card.getByRole("button",{name:"断开连接"}).click();
  await card.getByRole("status").filter({hasText:"已断开连接"}).waitFor();
  assert.equal(await card.getByLabel("App 专用密码",{exact:true}).inputValue(),"");
  assert.deepEqual(errors,[]);
  console.log("PASS: iCloud settings connect, masked password, calendar selection, reminder, error recovery and disconnect.");
} finally { await browser.close(); }
