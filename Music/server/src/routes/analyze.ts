import { Router } from "express";
import { z } from "zod";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { broadcastEvent } from "../services/wsManager.js";

// ── Load prompts from knowledge base document ──
const __promptsDir = dirname(fileURLToPath(import.meta.url));
const __promptsPath = resolve(__promptsDir, "..", "prompts", "style-analysis.md");
const __promptsRaw = readFileSync(__promptsPath, "utf-8");

function extractSection(markdown: string, sectionName: string): string {
  // "main": everything before the first named section marker
  if (sectionName === "main") {
    const idx = markdown.indexOf("\n<!-- section:");
    return cleanPrompt(idx >= 0 ? markdown.slice(0, idx) : markdown);
  }
  // Named sections: extract between markers
  const regex = new RegExp(`<!-- section: ${sectionName} -->\\n([\\s\\S]*?)(?=\\n<!-- section:|$)`, "m");
  const match = markdown.match(regex);
  if (!match) throw new Error(`Section "${sectionName}" not found in style-analysis.md`);
  return cleanPrompt(match[1]);
}

function cleanPrompt(raw: string): string {
  let lines = raw.trim().split("\n");
  // Skip heading lines, blockquotes, separators
  let i = 0;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (l.startsWith("#") || l.startsWith(">") || l.startsWith("---") || l === "") { i++; continue; }
    break;
  }
  let text = lines.slice(i).join("\n").trim();
  // Strip code blocks and format hints
  text = text.replace(/```json[\s\S]*?```/g, "").trim();
  text = text.replace(/⏬ 返回格式[：:][\s\S]*$/m, "").trim();
  return text;
}

const SYSTEM_PROMPT = `你是一位资深音乐风格分析师。根据以下音乐风格知识框架分析用户的歌曲列表。

${extractSection(__promptsRaw, "main")}

⚠️ 只返回一行完整 JSON：
{"styleProfile":"...","genreTags":["华语流行"],"moodTags":["热血"],"eraTags":["2020年代"],"languageTags":["中文"],"favoritePatterns":"...","recommendedSongIndices":[0,5,12,20]}`;

const BATCH_ANALYSIS_PROMPT = extractSection(__promptsRaw, "batch") + `\n\n⚠️ 只返回一行 JSON：{"genreTags":["华语流行"],"moodTags":["浪漫"],"eraTags":["2020年代"],"languageTags":["中文"],"recommendedSongIndices":[0,5,12]}`;

const SYNTHESIS_PROMPT = extractSection(__promptsRaw, "synthesis") + `\n\n⚠️ 只返回一行 JSON：{"styleProfile":"...","genreTags":["华语流行"],"moodTags":["治愈"],"eraTags":["2020年代"],"languageTags":["中文"],"favoritePatterns":"...","recommendedSongIndices":[0,5,12]}`;

const require = createRequire(import.meta.url);
const {
  playlist_track_all,
  playlist_create,
  playlist_tracks, // uses default crypto (cookie auth works), NOT playlist_track_add (weapi)
} = require("NeteaseCloudMusicApi");

interface SongMeta {
  id: string;
  name: string;
  artist: string;
  album: string;
}

interface AnalysisResult {
  styleProfile: string;
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  favoritePatterns: string;
  recommendedSongIndices: number[];
}

// ── helpers ──

function getCookie(): string | undefined {
  return config.netease.cookie || undefined;
}

function toNumeric(id: string): number {
  // 32-char hex → decimal; already numeric → parse as-is
  if (/^[0-9a-fA-F]{32}$/.test(id)) return parseInt(id, 16);
  return Number(id);
}

/** Map raw Netease song object to our SongMeta */
function mapSongMeta(raw: Record<string, unknown>): SongMeta {
  const id = String(raw.id ?? "");
  const name = String(raw.name ?? "");
  const ar = raw.ar as Array<{ name?: string }> | undefined;
  const artist = ar?.map((a) => a.name).filter(Boolean).join(" / ") ?? "";
  const al = raw.al as { name?: string } | undefined;
  const album = al?.name ?? "";
  return { id, name, artist, album };
}

/** Fetch ALL tracks from a playlist, with retry + batch size fallback */
async function fetchPlaylistTracks(
  playlistId: number,
): Promise<Record<string, unknown>[]> {
  // Try larger page first, fall back to smaller pages on network errors
  for (const pageSize of [800, 200]) {
    const songs = await fetchWithPagination(playlistId, pageSize);
    if (songs.length > 0) return songs;
    if (pageSize > 200) console.warn(`[analyze] playlist ${playlistId}: pageSize ${pageSize} failed, trying ${pageSize === 800 ? 200 : 100}...`);
  }
  return [];
}

async function fetchWithPagination(
  playlistId: number,
  pageSize: number,
): Promise<Record<string, unknown>[]> {
  const allSongs: Record<string, unknown>[] = [];
  let offset = 0;
  let consecutiveErrors = 0;

  while (consecutiveErrors < 3) {
    let songs: Record<string, unknown>[] | null = null;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const result = await playlist_track_all({
          id: playlistId,
          limit: pageSize,
          offset,
          cookie: getCookie(),
        });
        const body = result.body as { songs?: Record<string, unknown>[]; code?: number };
        if (body.code === 200 && body.songs) {
          songs = body.songs;
          consecutiveErrors = 0;
          break;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      } catch (e: any) {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }

    if (!songs || songs.length === 0) {
      consecutiveErrors++;
      offset += pageSize;
      continue;
    }

    allSongs.push(...songs);
    if (songs.length < pageSize) break;
    offset += pageSize;
  }

  if (allSongs.length > 0) {
    console.log(`[analyze] Playlist ${playlistId}: ${allSongs.length} tracks (pageSize=${pageSize})`);
  }
  return allSongs;
}

/** Try to repair truncated JSON by completing missing braces/brackets */
function repairJson(jsonStr: string): string {
  let s = jsonStr.trim();
  // Count unclosed braces/brackets
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === "[") bracketDepth++;
    else if (ch === "]") bracketDepth--;
  }
  // If inside a string, close it
  if (inString) s += '"';
  // Close remaining brackets/braces
  while (bracketDepth > 0) { s += "]"; bracketDepth--; }
  while (braceDepth > 0) { s += "}"; braceDepth--; }
  return s;
}

/** Parse AI response text into AnalysisResult, with progressive repair attempts */
function parseAnalysisResponse(responseText: string): AnalysisResult {
  // Attempt 1: strip markdown code fences
  let jsonStr = responseText.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  const attempts: string[] = [
    jsonStr,                          // raw
    repairJson(jsonStr),              // repaired truncated JSON
  ];

  // Attempt 2: extract first complete JSON object
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(jsonStr.slice(firstBrace, lastBrace + 1));
    attempts.push(repairJson(jsonStr.slice(firstBrace, lastBrace + 1)));
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt) as AnalysisResult;
      // At minimum we need recommendedSongIndices — styleProfile is optional for batch responses
      if (Array.isArray(parsed.recommendedSongIndices)) {
        return parsed;
      }
    } catch {
      // try next
    }
  }

  console.error("[analyze] All JSON parse attempts failed. Raw response (first 800 chars):",
    responseText.slice(0, 800));
  throw new Error(`AI 返回格式异常，请重试`);
}

/** Call DeepSeek API (Anthropic-compatible) for style analysis */
async function callAnalyzeAI(
  songs: SongMeta[],
  retryCount = 0
): Promise<AnalysisResult> {
  const url = `${config.deepseek.baseUrl}/v1/messages`;

  // Compact format: "idx. 歌名 — 歌手" (no album to save tokens)
  const songListText = songs
    .map((s, i) => `${i}. 《${s.name}》 — ${s.artist || "未知歌手"}`)
    .join("\n");

  // For retries, use fewer songs and ask for fewer recommendations
  const songsToAnalyze = retryCount > 0 ? songs.slice(0, Math.floor(songs.length / 2)) : songs;
  const userMessage = retryCount === 0
    ? `分析以下 ${songsToAnalyze.length} 首歌的音乐品味：\n\n${songListText}`
    : `精简分析以下 ${songsToAnalyze.length} 首歌（只需推荐 10-15 首）：\n\n${songsToAnalyze.map((s, i) => `${i}. 《${s.name}》 — ${s.artist || "未知"}`).join("\n")}`;

  const body = {
    model: config.deepseek.model,
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userMessage },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.deepseek.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };

  const textBlocks = json.content?.filter((b) => b.type === "text") ?? [];
  const responseText = textBlocks.map((b) => b.text ?? "").join("").trim();

  console.log(`[analyze] AI response stop_reason: ${json.stop_reason}, length: ${responseText.length}`);

  try {
    return parseAnalysisResponse(responseText);
  } catch (e) {
    // Retry once with fewer songs if first attempt fails
    if (retryCount === 0) {
      console.log("[analyze] First attempt failed, retrying with reduced song list...");
      return callAnalyzeAI(songs, retryCount + 1);
    }
    throw e;
  }
}

// ── batch analysis ──

interface BatchResult {
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  recommendedSongs: SongMeta[]; // subset of the batch
}

/** Analyze a single batch of songs */
async function analyzeBatch(
  songs: SongMeta[],
  batchIndex: number,
  totalBatches: number,
): Promise<BatchResult> {
  const songListText = songs
    .map((s, i) => `${i}. 《${s.name}》 — ${s.artist || "未知"}`)
    .join("\n");

  const body = {
    model: config.deepseek.model,
    max_tokens: 4096,
    system: BATCH_ANALYSIS_PROMPT,
    messages: [
      { role: "user" as const, content: `第 ${batchIndex + 1}/${totalBatches} 批，${songs.length} 首歌：\n\n${songListText}` },
    ],
  };

  const res = await fetch(`${config.deepseek.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.deepseek.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Batch ${batchIndex + 1} API error ${res.status}`);
  }

  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";

  const parsed = parseAnalysisResponse(text) as unknown as {
    genreTags: string[];
    moodTags: string[];
    eraTags: string[];
    languageTags: string[];
    recommendedSongIndices: number[];
  };

  return {
    genreTags: parsed.genreTags || [],
    moodTags: parsed.moodTags || [],
    eraTags: parsed.eraTags || [],
    languageTags: parsed.languageTags || [],
    recommendedSongs: (parsed.recommendedSongIndices || [])
      .map((i) => songs[i])
      .filter(Boolean),
  };
}

/** Synthesize results from all batches into a final analysis */
async function synthesizeResults(
  batchResults: BatchResult[],
  allRecommended: SongMeta[],
): Promise<{
  styleProfile: string;
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  favoritePatterns: string;
  recommendedSongIndices: number[];
}> {
  // Deduplicate recommended songs by ID for the synthesis pass
  const seen = new Set<string>();
  const uniqueSongs: SongMeta[] = [];
  for (const s of allRecommended) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      uniqueSongs.push(s);
    }
  }

  if (uniqueSongs.length === 0) {
    return {
      styleProfile: "分析失败",
      genreTags: [], moodTags: [], eraTags: [], languageTags: [],
      favoritePatterns: "",
      recommendedSongIndices: [],
    };
  }

  // Build summary of batch results
  const tagSummary = [
    `流派汇总: ${batchResults.flatMap((b) => b.genreTags).join("、")}`,
    `情绪汇总: ${batchResults.flatMap((b) => b.moodTags).join("、")}`,
    `年代汇总: ${batchResults.flatMap((b) => b.eraTags).join("、")}`,
    `语言汇总: ${batchResults.flatMap((b) => b.languageTags).join("、")}`,
  ].join("\n");

  const songListText = uniqueSongs
    .map((s, i) => `${i}. 《${s.name}》 — ${s.artist || "未知"}`)
    .join("\n");

  const body = {
    model: config.deepseek.model,
    max_tokens: 16384,
    system: SYNTHESIS_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `共 ${batchResults.length} 批分析结果：\n${tagSummary}\n\n所有精选歌曲（${uniqueSongs.length} 首）：\n${songListText}`,
      },
    ],
  };

  const res = await fetch(`${config.deepseek.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.deepseek.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Synthesis API error ${res.status}`);
  }

  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = json.content?.filter((b) => b.type === "text").map((b) => b.text ?? "").join("") ?? "";

  const parsed = parseAnalysisResponse(text) as unknown as {
    styleProfile: string;
    genreTags: string[];
    moodTags: string[];
    eraTags: string[];
    languageTags: string[];
    favoritePatterns: string;
    recommendedSongIndices: number[];
  };

  return {
    styleProfile: parsed.styleProfile || "",
    genreTags: parsed.genreTags || [],
    moodTags: parsed.moodTags || [],
    eraTags: parsed.eraTags || [],
    languageTags: parsed.languageTags || [],
    favoritePatterns: parsed.favoritePatterns || "",
    recommendedSongIndices: parsed.recommendedSongIndices || [],
  };
}

/** Full batch analysis: analyze batches → synthesize */
async function analyzeInBatches(
  allMetas: SongMeta[],
  batchSize: number,
): Promise<{
  styleProfile: string;
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  favoritePatterns: string;
  recommendedSongs: SongMeta[];
  totalSongs: number;
  analyzedSongs: number;
  batches: number;
}> {
  // Phase 1: split and analyze each batch
  const totalBatches = Math.ceil(allMetas.length / batchSize);
  const batchResults: BatchResult[] = [];

  broadcastEvent("analysis:progress", {
    phase: "batch",
    current: 0,
    total: totalBatches,
    message: `开始分析 ${allMetas.length} 首歌 (${totalBatches} 批)...`,
  });

  for (let i = 0; i < totalBatches; i++) {
    const batch = allMetas.slice(i * batchSize, (i + 1) * batchSize);
    const analyzedSoFar = Math.min((i + 1) * batchSize, allMetas.length);
    console.log(`[analyze] Batch ${i + 1}/${totalBatches}: ${batch.length} songs`);
    broadcastEvent("analysis:progress", {
      phase: "batch",
      current: i + 1,
      total: totalBatches,
      analyzedSoFar,
      totalSongs: allMetas.length,
      message: `第 ${i + 1}/${totalBatches} 批 · 已覆盖 ${analyzedSoFar}/${allMetas.length} 首`,
    });
    const result = await analyzeBatch(batch, i, totalBatches);
    batchResults.push(result);
  }

  // Collect all recommended songs from all batches
  const allRecommended = batchResults.flatMap((b) => b.recommendedSongs);

  // Phase 2: synthesize
  broadcastEvent("analysis:progress", {
    phase: "synthesis",
    current: 0,
    total: 1,
    message: `综合分析 ${batchResults.length} 批结果 (${allRecommended.length} 首精选)...`,
  });
  console.log(`[analyze] Synthesizing ${batchResults.length} batches, ${allRecommended.length} recommended songs`);
  const synthesis = await synthesizeResults(batchResults, allRecommended);

  broadcastEvent("analysis:progress", {
    phase: "done",
    current: 1,
    total: 1,
    message: "分析完成！",
  });

  // Map synthesis indices back to the unique recommended songs
  const seen = new Set<string>();
  const uniqueRecommended: SongMeta[] = [];
  for (const s of allRecommended) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      uniqueRecommended.push(s);
    }
  }

  const finalSongs = synthesis.recommendedSongIndices
    .map((i) => uniqueRecommended[i])
    .filter(Boolean);

  return {
    styleProfile: synthesis.styleProfile,
    genreTags: synthesis.genreTags,
    moodTags: synthesis.moodTags,
    eraTags: synthesis.eraTags,
    languageTags: synthesis.languageTags,
    favoritePatterns: synthesis.favoritePatterns,
    recommendedSongs: finalSongs,
    totalSongs: allMetas.length,
    analyzedSongs: allMetas.length,
    batches: totalBatches,
  };
}

// ── router ──

export const analyzeRouter = Router();

/**
 * POST /api/analyze/style
 * Analyze music style from selected playlists
 */
analyzeRouter.post("/style", async (req, res, next) => {
  try {
    const { playlistIds } = z
      .object({ playlistIds: z.array(z.string()).min(1).max(20) })
      .parse(req.body);

    // 1. Fetch all tracks from all playlists concurrently
    const trackArrays = await Promise.all(
      playlistIds.map((id) => fetchPlaylistTracks(toNumeric(id)))
    );

    // 2. Flatten and deduplicate by song ID
    const seen = new Set<string>();
    const allSongs: Record<string, unknown>[] = [];
    for (const tracks of trackArrays) {
      for (const t of tracks) {
        const sid = String(t.id ?? "");
        if (!seen.has(sid)) {
          seen.add(sid);
          allSongs.push(t);
        }
      }
    }

    if (allSongs.length === 0) {
      return res.json({
        success: false,
        error: "所选歌单中没有歌曲",
      });
    }

    // 3. Map to metadata
    const allMetas = allSongs.map(mapSongMeta);

    // 4. Check AI key
    if (!config.deepseek.apiKey) {
      return res.json({
        success: false,
        error: "未配置 AI API Key，请在 Music/server/.env 中设置 ANTHROPIC_AUTH_TOKEN",
      });
    }

    // 5. Analyze — batch mode for large lists, single pass for small ones
    const BATCH_SIZE = 400;
    const useBatch = allMetas.length > BATCH_SIZE;

    let finalAnalysis: {
      styleProfile: string;
      genreTags: string[];
      moodTags: string[];
      eraTags: string[];
      languageTags: string[];
      favoritePatterns: string;
      recommendedSongs: SongMeta[];
      totalSongs: number;
      analyzedSongs: number;
      batches: number;
    };

    if (useBatch) {
      console.log(`[analyze] Batch mode: ${allMetas.length} songs → ${Math.ceil(allMetas.length / BATCH_SIZE)} batches`);
      finalAnalysis = await analyzeInBatches(allMetas, BATCH_SIZE);
    } else {
      console.log(`[analyze] Single pass: ${allMetas.length} songs`);
      const single = await callAnalyzeAI(allMetas);
      finalAnalysis = {
        styleProfile: single.styleProfile,
        genreTags: single.genreTags,
        moodTags: single.moodTags,
        eraTags: single.eraTags,
        languageTags: single.languageTags,
        favoritePatterns: single.favoritePatterns,
        recommendedSongs: single.recommendedSongIndices
          .map((i) => allMetas[i])
          .filter(Boolean),
        totalSongs: allMetas.length,
        analyzedSongs: allMetas.length,
        batches: 1,
      };
    }

    return res.json({
      success: true,
      data: {
        styleProfile: finalAnalysis.styleProfile,
        genreTags: finalAnalysis.genreTags,
        moodTags: finalAnalysis.moodTags,
        eraTags: finalAnalysis.eraTags,
        languageTags: finalAnalysis.languageTags,
        favoritePatterns: finalAnalysis.favoritePatterns,
        recommendedSongs: finalAnalysis.recommendedSongs,
        totalSongs: finalAnalysis.totalSongs,
        analyzedSongs: finalAnalysis.analyzedSongs,
        batches: finalAnalysis.batches,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/analyze/generate-playlist
 * Generate a new playlist from analyzed songs
 */
analyzeRouter.post("/generate-playlist", async (req, res, next) => {
  try {
    const { name, songIds } = z
      .object({
        name: z.string().min(1).max(50),
        songIds: z.array(z.string()).min(1).max(1000),
      })
      .parse(req.body);

    const cookie = getCookie();
    if (!cookie) {
      return res.json({ success: false, error: "未登录，请先登录网易云音乐" });
    }

    const result = await createPlaylistViaApi(name, songIds, cookie);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

async function createPlaylistViaApi(
  name: string,
  songIds: string[],
  cookie: string | undefined,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Step 1: create playlist
  let createBody: { code?: number; id?: number; playlist?: { id?: number }; message?: string };
  try {
    const createResult = await playlist_create({ name, privacy: 0, cookie });
    createBody = createResult.body as typeof createBody;
  } catch (httpErr) {
    console.error("[analyze] playlist_create HTTP error:", httpErr);
    return {
      success: false,
      error: "创建歌单失败：登录态已过期或权限不足。请重新扫码登录。",
    };
  }

  if (createBody.code !== 200) {
    console.error("[analyze] playlist_create returned:", createBody);
    return {
      success: false,
      error: `创建歌单失败 (${createBody.message || `code ${createBody.code}`})。请重新扫码登录获取完整权限。`,
    };
  }

  const pidNum = createBody.id ?? createBody.playlist?.id;
  if (!pidNum) {
    return { success: false, error: "创建歌单成功但未获取到 ID" };
  }
  const pid = String(pidNum);

  console.log(`[analyze] Created playlist: ${pid}, adding ${songIds.length} songs`);

  // Step 2: add songs — use same ID conversion as playlist.ts
  const numericIds = songIds.map((id) => {
    if (/^[0-9a-fA-F]{32}$/.test(id)) return String(parseInt(id, 16));
    return id;
  });

  // Split into batches of 200 to avoid API limits
  const BATCH = 200;
  let added = 0;
  for (let i = 0; i < numericIds.length; i += BATCH) {
    const batch = numericIds.slice(i, i + BATCH);
    const tracks = batch.join(",");
    console.log(`[analyze] Adding batch ${Math.floor(i / BATCH) + 1}: ${batch.length} songs, first IDs: ${batch.slice(0, 3).join(",")}`);

    try {
      const addResult = await playlist_tracks({
        op: "add",
        pid,
        tracks: batch.join(","), // playlist_tracks uses default crypto — cookie auth works
        cookie,
      });
      const addBody = addResult.body as { code?: number; message?: string; count?: number };
      console.log(`[analyze] playlist_track_add response: code=${addBody.code}, count=${addBody.count}, message=${addBody.message || "none"}`);

      if (addBody.code !== 200) {
        console.error(`[analyze] Batch add failed:`, JSON.stringify(addBody));
        return {
          success: true,
          data: { playlistId: pid, name, trackCount: added },
          error: `部分歌曲添加失败 (已添加 ${added}/${songIds.length}): ${addBody.message || `code ${addBody.code}`}`,
        };
      }
      added += batch.length;
    } catch (httpErr) {
      console.error(`[analyze] playlist_track_add HTTP error:`, httpErr);
      return {
        success: true,
        data: { playlistId: pid, name, trackCount: added },
        error: `部分歌曲添加失败 (已添加 ${added}/${songIds.length})`,
      };
    }
  }

  console.log(`[analyze] All ${added} songs added to playlist ${pid}`);
  return { success: true, data: { playlistId: pid, name, trackCount: added } };
}
