import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { config } from "../config.js";
import { runNcm } from "./ncmExecutor.js";
import { normalizeState } from "./stateTransform.js";
import * as mpv from "./mpvController.js";

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
  // Try mpvController first (direct mpv IPC — more reliable)
  const mpvState = await mpv.getState();
  let state: { playing: boolean; song?: { name: string; artist: string; duration: number; position: number }; volume: number; currentIndex?: number; queueLength?: number };

  if (mpvState && mpvState.filename) {
    const meta = mpv.getCurrentMeta();
    state = {
      playing: mpvState.playing,
      song: {
        name: meta?.name || mpvState.filename,
        artist: meta?.artist || "",
        duration: meta?.duration || mpvState.duration,
        position: mpvState.position,
      },
      volume: mpvState.volume,
    };
  } else if (mpvState) {
    state = {
      playing: mpvState.playing,
      volume: mpvState.volume,
    };
  } else {
    // Fallback to ncm-cli
    const result = await runNcm("state");
    if (!result.success || !result.data) return;
    state = normalizeState(result.data);
  }

  const payload = JSON.stringify({ event: "playback:state", data: state });
  const current = JSON.stringify(state);

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

/** Broadcast a custom event to all connected clients */
export function broadcastEvent(event: string, data: unknown): void {
  const payload = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
