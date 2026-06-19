/**
 * Kill any processes occupying project ports (3000, 3001, 5173, 5174).
 * Called by `npm run dev` before starting services.
 */
const { execSync } = require("child_process");

const PORTS = [3000, 3001, 3002, 5173, 5174, 5175];

for (const port of PORTS) {
  try {
    // Windows: netstat → find PID → taskkill
    const out = execSync(
      `netstat -ano | findstr "LISTENING" | findstr ":${port} "`,
      { encoding: "utf8", timeout: 3000 }
    ).trim();

    if (!out) continue;

    // Each line: "  TCP    0.0.0.0:3001          0.0.0.0:0              LISTENING       12345"
    const lines = out.split("\n");
    const killed = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !killed.has(pid)) {
        killed.add(pid);
        try {
          execSync(`taskkill /F /PID ${pid}`, { timeout: 3000 });
        } catch { /* already gone */ }
      }
    }
  } catch {
    // Port is free or netstat failed — either way, fine
  }
}

// Also kill leftover mpv processes
try { execSync("taskkill /F /IM mpv.com", { timeout: 2000 }); } catch {}
try { execSync("taskkill /F /IM mpv.exe", { timeout: 2000 }); } catch {}
