import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(path.join(os.tmpdir(), "outdoor-api-test-"));
const vault = path.join(directory, "what.vault");
const port = "13004";
const server = spawn(process.execPath, ["server/dist/index.js"], {
  cwd: new URL("../", import.meta.url), env:{...process.env,PORT:port,VAULT_FILE:vault}, stdio:"pipe", windowsHide:true,
});
let output = "";
server.stdout.on("data", data => {output+=String(data);});
server.stderr.on("data", data => {output+=String(data);});
const request = async (route, method="GET", data, origin="http://localhost:5177") => {
  const result = await fetch("http://127.0.0.1:" + port + route, {method,headers:{Origin:origin,...(data ? {"Content-Type":"application/json"} : {})}, ...(data ? {body:JSON.stringify(data)} : {})});
  return {status:result.status,body:await result.json()};
};
try {
  for (let tries=0; tries<50; tries++) {
    try { if ((await request("/api/health")).status === 200) break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal((await request("/api/outdoor/map/status")).status,423);
  assert.equal((await request("/api/storage/unlock","POST",{password:"api-test-password"})).status,200);
  assert.equal((await request("/api/outdoor/map/status")).body.ready,false);
  assert.equal((await request("/api/outdoor/map/config","PUT",{jsKey:"invalid"})).status,400);
  const credentials={jsKey:"a".repeat(32),securityCode:"b".repeat(32),serviceKey:"c".repeat(32)};
  assert.equal((await request("/api/outdoor/map/config","PUT",credentials,"http://localhost:5173")).body.ready,true);
  const settingsStatus = await request("/api/outdoor/map/status","GET",undefined,"http://127.0.0.1:5173");
  assert.deepEqual(settingsStatus.body,{jsReady:true,serviceReady:true,ready:true});
  const sdk=await request("/api/outdoor/map/sdk");
  assert.equal(sdk.body.key,credentials.jsKey);
  assert.equal(sdk.body.serviceKey,undefined);
  assert.equal((await request("/api/outdoor/map/sdk","GET",undefined,"https://untrusted.example")).status,403);
  assert.equal((await request("/api/outdoor/journeys","POST",{version:2})).status,400);
  assert.equal((await request("/api/outdoor/generate","POST",{query:"旧模板"})).status,410);
  assert.equal((await request("/api/outdoor/plans","POST",{})).status,410);
  assert.equal((await request("/api/outdoor/settings","PUT",{homeAddress:"api-private-home"})).status,200);
  assert.equal((await request("/api/outdoor/settings")).body.serviceKey,undefined);
  assert.equal((await request("/api/outdoor/map/status")).body.ready,true);
  const contents=await readFile(vault,"utf8");
  assert.ok(!contents.includes(credentials.serviceKey) && !contents.includes("api-private-home"));
  assert.ok(!output.includes(credentials.serviceKey) && !output.includes("api-private-home"));
  console.log("PASS: real Express endpoints, locked vault, key validation/redaction, origin restriction, encrypted persistence, legacy API disabled.");
} finally {
  server.kill();
  await new Promise(resolve=>server.once("exit",resolve));
  await rm(directory,{recursive:true,force:true});
}
