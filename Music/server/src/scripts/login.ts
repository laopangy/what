/**
 * 网易云音乐扫码登录 — 自动保存 Cookie 到 .env
 * 运行: npx tsx Music/server/src/scripts/login.ts
 */
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";

const require = createRequire(import.meta.url);
const { login_qr_key, login_qr_create, login_qr_check } = require("NeteaseCloudMusicApi");

async function qrcodeLogin(): Promise<string> {
  // 1. 获取二维码 key
  const keyRes = await login_qr_key({});
  const unikey = (keyRes.body as any).data?.unikey;
  if (!unikey) throw new Error("获取二维码 key 失败");

  // 2. 生成二维码
  const qrRes = await login_qr_create({ key: unikey, qrimg: true });
  const qrimg = (qrRes.body as any).data?.qrimg;
  if (!qrimg) throw new Error("生成二维码失败");

  // 3. 输出二维码 URL（base64 图片太大了，用文字链接代替）
  console.log("\n📱 请打开以下链接扫码登录：");
  console.log(`   https://music.163.com/login?codekey=${unikey}\n`);
  console.log("（如果链接打不开，请在手机网易云 APP 中扫码登录）\n");

  // 4. 轮询检查登录状态
  let lastCode = 0;
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    try {
      const checkRes = await login_qr_check({ key: unikey });
      const code = (checkRes.body as any).code;

      if (code !== lastCode) {
        lastCode = code;
        if (code === 800) {
          console.log("⏳ 二维码已过期，正在重新获取...");
          return qrcodeLogin();
        }
        if (code === 803) {
          const cookie = (checkRes.body as any).cookie;
          console.log("✅ 登录成功！");
          return cookie;
        }
        if (code === 802) console.log("📱 请在手机上确认登录...");
        if (code === 801) console.log("⏳ 等待扫码...");
      }
    } catch (e: any) {
      // Network errors are common — keep polling
      if (i % 10 === 0) console.log(`  网络波动，继续重试... (${i}/120)`);
    }
  }
  throw new Error("登录超时");
}

function saveCookie(cookie: string): void {
  const envPath = path.resolve(import.meta.dirname, "..", "..", "..", ".env");
  let content = fs.readFileSync(envPath, "utf-8");

  if (content.includes("NETEASE_COOKIE=")) {
    // Replace existing
    content = content.replace(
      /NETEASE_COOKIE=.*/,
      `NETEASE_COOKIE=${cookie}`
    );
  } else {
    // Append
    content += `\nNETEASE_COOKIE=${cookie}\n`;
  }

  fs.writeFileSync(envPath, content);
  console.log(`📝 Cookie 已保存到 ${envPath}`);
}

async function main() {
  try {
    const cookie = await qrcodeLogin();
    saveCookie(cookie);
    console.log("\n🎵 现在重启服务即可播放 VIP 歌曲完整版！");
  } catch (e: any) {
    console.error("❌ 登录失败:", e.message);
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main();
