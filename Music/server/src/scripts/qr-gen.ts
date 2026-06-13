import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { writeFileSync, readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { login_qr_key, login_qr_create, login_qr_check } = require("NeteaseCloudMusicApi");

async function gen() {
  const keyFile = resolve(__dirname, "..", ".qrkey.tmp");
  const envPath = resolve(__dirname, "..", "..", ".env");
  const imgPath = resolve(__dirname, "..", "..", "qr-login.png");
  let unikey: string;

  // Try to reuse existing key
  if (existsSync(keyFile)) {
    unikey = readFileSync(keyFile, "utf-8").trim();
    console.log("检查已有二维码状态...");
    try {
      const check = await login_qr_check({ key: unikey });
      const code = (check.body as any).code;
      if (code === 803) {
        const cookie = (check.body as any).cookie;
        console.log("✅ 已扫码登录！Cookie:", cookie.slice(0, 80) + "...");
        saveCookie(cookie, envPath);
        return;
      }
      if (code === 800) {
        console.log("二维码已过期，重新生成...");
      } else {
        console.log(`状态: ${code} (801=等待扫码, 802=等待确认)`);
        console.log(`链接: https://music.163.com/login?codekey=${unikey}`);
        return; // Keep waiting
      }
    } catch (e: any) {
      console.log("检查失败:", e.message?.slice(0, 80));
    }
  }

  // Generate new QR
  const keyRes = await login_qr_key({});
  unikey = (keyRes.body as any).data?.unikey;

  const qrRes = await login_qr_create({ key: unikey, qrimg: true });
  const qrimg = (qrRes.body as any).data?.qrimg; // 官方 base64 图片（含 data:image 前缀）
  const b64 = qrimg.includes(",") ? qrimg.split(",")[1] : qrimg;
  writeFileSync(imgPath, Buffer.from(b64, "base64"));

  // Also generate an HTML file so the user can open it in browser
  const htmlPath = resolve(__dirname, "..", "..", "qr-login.html");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>网易云扫码登录</title>
<style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1a1a2e;flex-direction:column;font-family:sans-serif}img{border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.4)}p{color:#ccc;margin-top:24px;font-size:14px}</style>
</head><body><img src="${qrimg}" width="300"><p>📱 用手机网易云 APP 扫一扫</p></body></html>`;
  writeFileSync(htmlPath, html);

  console.log("✅ 官方二维码已生成");
  console.log(`打开: Music/server/qr-login.html`);
  console.log(`或链接: https://music.163.com/login?codekey=${unikey}`);
  writeFileSync(keyFile, unikey);
}

function saveCookie(cookie: string, envPath: string) {
  let content = readFileSync(envPath, "utf-8");
  if (content.includes("NETEASE_COOKIE=")) {
    content = content.replace(/NETEASE_COOKIE=.*/, `NETEASE_COOKIE=${cookie}`);
  } else {
    content += `\nNETEASE_COOKIE=${cookie}\n`;
  }
  writeFileSync(envPath, content);
  console.log("📝 Cookie 已写入 .env");
}

gen().catch(e => { console.error(e.message); process.exit(1); });
