import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { config } from "../config.js";
import { runNcm } from "./ncmExecutor.js";
import { normalizeState } from "./stateTransform.js";

let wss: WebSocketServer | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastState: string | null = null;
const clients = new Set<WebSocket>();

export function setupWebSocket(server: Server): void {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log(`WS client connected (${clients.size} total)`);

    if (clients.size === 1) {
      startPolling();
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === "subscribe:playback") {
          sendPlaybackState(ws);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`WS client disconnected (${clients.size} left)`);
      if (clients.size === 0) {
        stopPolling();
      }
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  console.log("WebSocket server ready");
}

async function sendPlaybackState(ws?: WebSocket): Promise<void> {
  const result = await runNcm("state");
  if (!result.success || !result.data) return;

  const normalized = normalizeState(result.data);
  const payload = JSON.stringify({ event: "playback:state", data: normalized });
  const current = JSON.stringify(normalized);

  if (current === lastState) return;
  lastState = current;

  if (ws) {
    ws.send(payload);
  } else {
    broadcast(payload);
  }
}

function broadcast(message: string): void {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function startPolling(): void {
  if (pollTimer) return;
  console.log(`Starting playback polling every ${config.playback.pollIntervalMs}ms`);
  pollTimer = setInterval(() => {
    sendPlaybackState();
  }, config.playback.pollIntervalMs);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("Playback polling stopped (no clients)");
  }
}

export function notifyPlaybackChange(): void {
  lastState = null;
  sendPlaybackState();
}

export function getClientCount(): number {
  return clients.size;
}
