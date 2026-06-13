/**
 * Direct mpv controller via JSON IPC named pipe.
 *
 * ncm-cli v0.1.5 has a bug where `play --song --encrypted-id ...` fails to
 * start the playback process.  This module bypasses ncm-cli for playback by
 * managing mpv directly — starting it, sending commands over IPC, and
 * inferring state from the responses.
 */
import { spawn, type ChildProcess } from "child_process";
import { createConnection, type Socket } from "net";

const IPC_PIPE = "\\\\.\\pipe\\mpv-socket";
const MPV_EXE = "mpv.com";

// ── IPC helpers ──────────────────────────────────────────────────────────────
// Single-command send
function sendCommand(cmd: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const client = createConnection(IPC_PIPE, () => {
      client.write(JSON.stringify(cmd) + "\n");
    });

    let data = "";
    let resolved = false;

    client.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes("\n") && !resolved) {
        resolved = true;
        client.destroy(); // Fully close connection (not just end)
        try {
          resolve(JSON.parse(data.trim()));
        } catch {
          resolve({ error: "parse-failed" });
        }
      }
    });

    client.on("error", () => {
      if (!resolved) { resolved = true; client.destroy(); reject(new Error("IPC error")); }
    });
    client.setTimeout(2000, () => {
      if (!resolved) { resolved = true; client.destroy(); reject(new Error("IPC timeout")); }
    });
  });
}

// Batch multiple commands over a single connection
function sendCommands(cmds: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const client = createConnection(IPC_PIPE, () => {
      // mpv IPC supports array of commands → array of responses
      client.write(JSON.stringify(cmds) + "\n");
    });

    let data = "";
    let resolved = false;

    client.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes("\n") && !resolved) {
        resolved = true;
        client.destroy();
        try {
          const responses = JSON.parse(data.trim());
          resolve(Array.isArray(responses) ? responses : [responses]);
        } catch {
          resolve([]);
        }
      }
    });

    client.on("error", () => {
      if (!resolved) { resolved = true; client.destroy(); reject(new Error("IPC batch error")); }
    });
    client.setTimeout(2000, () => {
      if (!resolved) { resolved = true; client.destroy(); reject(new Error("IPC batch timeout")); }
    });
  });
}

// ── Metadata tracking ───────────────────────────────────────────────────────
let currentMeta: { name: string; artist: string; duration: number } | null = null;

export function setCurrentMeta(meta: { name: string; artist: string; duration: number } | null): void {
  currentMeta = meta;
}

export function getCurrentMeta(): { name: string; artist: string; duration: number } | null {
  return currentMeta;
}

// Track playlist metadata for queue display
let playlistTracks: { name: string; artist: string; url?: string }[] = [];

export function setPlaylistTracks(tracks: { name: string; artist: string; url?: string }[]): void {
  playlistTracks = tracks;
}

export async function appendToPlaylist(url: string): Promise<boolean> {
  try {
    await sendCommand({ command: ["loadfile", url, "append"] });
    return true;
  } catch { return false; }
}

export async function removeFromPlaylist(index: number): Promise<boolean> {
  try {
    await sendCommand({ command: ["playlist-remove", index] });
    // Remove from our tracked list too
    playlistTracks.splice(index, 1);
    return true;
  } catch { return false; }
}

export async function getPlaylist(): Promise<{ index: number; name: string; artist: string; current: boolean }[]> {
  try {
    let currentPos = -1;
    try {
      const posRes = await sendCommand({ command: ["get_property", "playlist-pos"] });
      currentPos = (posRes as any)?.data ?? -1;
    } catch { /* ignore */ }

    // Return from our tracked metadata, not mpv's raw filenames
    return playlistTracks.map((meta, i) => ({
      index: i,
      name: meta.name,
      artist: meta.artist,
      current: i === currentPos,
    }));
  } catch {
    return [];
  }
}

// ── Process management ──────────────────────────────────────────────────────
let mpvProc: ChildProcess | null = null;
let startPromise: Promise<boolean> | null = null;
let playingSince: number = 0;  // timestamp when last playUrl was called

export function isRunning(): boolean {
  return mpvProc !== null && mpvProc.exitCode === null;
}

export async function ensureMpv(): Promise<boolean> {
  if (isRunning()) return true;

  // Prevent concurrent start attempts
  if (startPromise) return startPromise;

  startPromise = doStart();
  const ok = await startPromise;
  startPromise = null;
  return ok;
}

async function doStart(): Promise<boolean> {
  try {
    // Quick test: maybe mpv is already running with IPC (started externally)
    await sendCommand({ command: ["get_property", "volume"] });
    return true;
  } catch {
    // Not running — start it
  }

  return new Promise((resolve) => {
    mpvProc = spawn(MPV_EXE, [
      `--input-ipc-server=${IPC_PIPE}`,
      "--idle=yes",
      "--volume=70",
      "--no-terminal",
      "--no-video",
      "--no-config",
      "--really-quiet",
      "--cache=yes",
      "--cache-secs=10",
      "--demuxer-max-bytes=75M",
      "--stream-buffer-size=4M",
    ], {
      stdio: "ignore",
      detached: false,
      windowsHide: true,
    });

    mpvProc.on("error", () => {
      mpvProc = null;
      resolve(false);
    });

    mpvProc.on("exit", () => {
      mpvProc = null;
      playingSince = 0;
    });

    // Wait briefly then verify IPC is up
    setTimeout(async () => {
      for (let i = 0; i < 10; i++) {
        try {
          await sendCommand({ command: ["get_property", "volume"] });
          resolve(true);
          return;
        } catch {
          await sleep(300);
        }
      }
      resolve(false);
    }, 500);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function stopMpv(): void {
  if (mpvProc && mpvProc.exitCode === null) {
    try {
      sendCommand({ command: ["quit"] }).catch(() => {});
    } catch { /* ignore */ }
    setTimeout(() => {
      try { mpvProc?.kill(); } catch { /* ignore */ }
      mpvProc = null;
    }, 1000);
  }
}

// ── Playback commands ────────────────────────────────────────────────────────
export async function playUrl(url: string): Promise<boolean> {
  const ok = await ensureMpv();
  if (!ok) return false;
  try {
    // Clear old playlist and metadata to avoid stale info
    playlistTracks = [];
    await sendCommand({ command: ["playlist_clear"] });
    await sendCommand({ command: ["loadfile", url, "replace"] });
    await sendCommand({ command: ["set_property", "pause", false] });
    playingSince = Date.now();
    return true;
  } catch {
    return false;
  }
}

/**
 * Play a list of URLs as an mpv playlist.
 * Clears existing playlist, loads all tracks, and starts playing from the first.
 */
export async function playPlaylist(
  tracks: { url: string; name?: string; artist?: string; duration?: number }[],
): Promise<boolean> {
  const ok = await ensureMpv();
  if (!ok) return false;
  try {
    // Stop current playback and clear playlist
    await sendCommand({ command: ["stop"] });
    await sendCommand({ command: ["playlist_clear"] });

    if (tracks.length === 0) return false;

    // Load first track (replace)
    await sendCommand({ command: ["loadfile", tracks[0].url, "replace"] });
    // Save metadata for the first track
    if (tracks[0].name) {
      currentMeta = {
        name: tracks[0].name,
        artist: tracks[0].artist || "",
        duration: tracks[0].duration || 0,
      };
    }

    // Append remaining tracks
    for (let i = 1; i < tracks.length; i++) {
      await sendCommand({ command: ["loadfile", tracks[i].url, "append"] });
    }

    // Start playback
    await sendCommand({ command: ["set_property", "pause", false] });
    playingSince = Date.now();
    return true;
  } catch {
    return false;
  }
}

export async function togglePause(): Promise<boolean> {
  try {
    const res = await sendCommand({ command: ["get_property", "pause"] });
    const paused = res?.data === true;
    await sendCommand({ command: ["set_property", "pause", !paused] });
    return true;
  } catch {
    return false;
  }
}

export async function pause(): Promise<boolean> {
  try {
    await sendCommand({ command: ["set_property", "pause", true] });
    playingSince = 0;  // mark as paused
    return true;
  } catch {
    return false;
  }
}

export async function resume(): Promise<boolean> {
  try {
    await sendCommand({ command: ["set_property", "pause", false] });
    playingSince = Date.now();
    return true;
  } catch {
    return false;
  }
}

export async function stop(): Promise<boolean> {
  try {
    await sendCommand({ command: ["stop"] });
    playingSince = 0;
    currentMeta = null;
    return true;
  } catch {
    return false;
  }
}

/** Sync currentMeta from playlistTracks based on current mpv position */
async function syncMetaFromPlaylist(): Promise<void> {
  try {
    const posRes = await sendCommand({ command: ["get_property", "playlist-pos"] });
    const pos = (posRes as any)?.data;
    if (typeof pos === "number" && pos >= 0 && pos < playlistTracks.length) {
      const t = playlistTracks[pos];
      currentMeta = { name: t.name, artist: t.artist, duration: currentMeta?.duration || 0 };
    }
  } catch { /* ignore */ }
}

export async function next(): Promise<boolean> {
  try {
    await sendCommand({ command: ["playlist-next"] });
    await syncMetaFromPlaylist();
    return true;
  } catch {
    return false;
  }
}

export async function prev(): Promise<boolean> {
  try {
    await sendCommand({ command: ["playlist-prev"] });
    await syncMetaFromPlaylist();
    return true;
  } catch {
    return false;
  }
}

export async function seek(seconds: number): Promise<boolean> {
  try {
    await sendCommand({ command: ["set_property", "time-pos", seconds] });
    return true;
  } catch {
    return false;
  }
}

export async function setVolume(level: number): Promise<boolean> {
  try {
    await sendCommand({ command: ["set_property", "volume", Math.round(level)] });
    return true;
  } catch {
    return false;
  }
}

/** Shuffle is a one-time command in mpv (not a property). */
export async function shufflePlaylist(): Promise<boolean> {
  try {
    await sendCommand({ command: ["playlist-shuffle"] });
    return true;
  } catch { return false; }
}

export async function setLoop(mode: "none" | "single" | "list"): Promise<boolean> {
  try {
    const loopFile = mode === "single" ? "inf" : "no";
    const loopList = mode === "list" ? "inf" : "no";
    // Set loop-file first, then loop-playlist (order matters — setting loop-playlist can reset loop-file)
    if (mode === "single") {
      await sendCommand({ command: ["set_property", "loop-playlist", "no"] });
      await sendCommand({ command: ["set_property", "loop-file", "inf"] });
    } else if (mode === "list") {
      await sendCommand({ command: ["set_property", "loop-file", "no"] });
      await sendCommand({ command: ["set_property", "loop-playlist", "inf"] });
    } else {
      await sendCommand({ command: ["set_property", "loop-file", "no"] });
      await sendCommand({ command: ["set_property", "loop-playlist", "no"] });
    }
    return true;
  } catch { return false; }
}

// ── State query ──────────────────────────────────────────────────────────────
export interface MpvState {
  playing: boolean;
  filename?: string;
  duration: number;
  position: number;
  volume: number;
  paused: boolean;
}

// ── State queries ───────────────────────────────────────────────────────────

// Used for polling. Gets real position from mpv for accurate lyrics sync.
export async function getState(): Promise<MpvState | null> {
  if (!isRunning()) {
    playingSince = 0;
    return null;
  }

  try {
    // Query pause and time-pos individually (batch sendCommands unreliable)
    const pauseRes = await sendCommand({ command: ["get_property", "pause"] });
    const paused = (pauseRes as any)?.data === true;

    let realPos = 0;
    try {
      const posRes = await sendCommand({ command: ["get_property", "time-pos"] });
      realPos = (posRes as any)?.data ?? 0;
    } catch { /* ignore */ }

    if (paused && playingSince === 0) {
      return { playing: false, duration: 0, position: 0, volume: 70, paused: true };
    }

    // Use real mpv time-pos when available, fall back to estimate
    const position = typeof realPos === "number" && realPos > 0
      ? realPos
      : (playingSince ? (Date.now() - playingSince) / 1000 : 0);

    // Sync metadata from playlist (handles auto-advance when song ends)
    if (playlistTracks.length > 0) {
      try {
        const posRes = await sendCommand({ command: ["get_property", "playlist-pos"] });
        const pos = (posRes as any)?.data;
        if (typeof pos === "number" && pos >= 0 && pos < playlistTracks.length) {
          const t = playlistTracks[pos];
          currentMeta = { name: t.name, artist: t.artist, duration: currentMeta?.duration || 0 };
        }
      } catch { /* ignore */ }
    }

    return {
      playing: !paused || playingSince > 0,
      filename: playingSince > 0 ? currentMeta?.name : undefined,
      duration: currentMeta?.duration || 0,
      position,
      volume: 70,
      paused,
    };
  } catch {
    // IPC busy — fall back to process check
    return {
      playing: playingSince > 0,
      filename: currentMeta?.name,
      duration: currentMeta?.duration || 0,
      position: playingSince ? (Date.now() - playingSince) / 1000 : 0,
      volume: 70,
      paused: false,
    };
  }
}

// Full state query with IPC (used for explicit /state API calls)
let cachedFullState: MpvState | null = null;

export async function getFullState(): Promise<MpvState | null> {
  try {
    const r1 = await sendCommand({ command: ["get_property", "pause"] }).catch(() => null);
    const r2 = await sendCommand({ command: ["get_property", "duration"] }).catch(() => null);
    const r3 = await sendCommand({ command: ["get_property", "time-pos"] }).catch(() => null);
    const r4 = await sendCommand({ command: ["get_property", "volume"] }).catch(() => null);

    const paus = (r1 as any)?.data ?? false;
    const dur  = (r2 as any)?.data ?? 0;
    const pos  = (r3 as any)?.data ?? 0;
    const vol  = (r4 as any)?.data ?? 70;

    const state: MpvState = {
      playing: !paus && ((dur as number) > 0 || (currentMeta?.duration || 0) > 0),
      filename: currentMeta?.name,
      duration: (dur as number) || currentMeta?.duration || 0,
      position: Math.min((pos as number) || 0, (dur as number) || currentMeta?.duration || 0),
      volume: (vol as number) || 70,
      paused: (paus as boolean) || false,
    };

    cachedFullState = state;
    return state;
  } catch {
    return cachedFullState;
  }
}
