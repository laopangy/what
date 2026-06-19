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
  let i = 0;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (l.startsWith("#") || l.startsWith(">") || l.startsWith("---") || l === "") { i++; continue; }
    break;
  }
  let text = lines.slice(i).join("\n").trim();
  text = text.replace(/```json[\s\S]*?```/g, "").trim();
  text = text.replace(/⏬ 返回格式[：:][\s\S]*$/m, "").trim();
  return text;
}

// ── System prompts for each analysis phase ──

const TASTE_PROFILE_PROMPT = `你是一位资深音乐品味分析师。根据以下音乐风格知识框架分析用户的歌曲列表。

${extractSection(__promptsRaw, "main")}

⚠️ 只返回一行完整 JSON：
{"styleProfile":"...","tasteClusters":[{"name":"...","percentage":35,"description":"...","keyArtists":["..."]}],"genreTags":["华语流行(40%)"],"moodTags":["热血(30%)"],"eraTags":["2020年代(55%)"],"languageTags":["中文(75%)"],"favoritePatterns":"..."}`;

const SONG_SELECTION_PROMPT = `你是一位音乐策展人。基于品味画像，从歌曲列表中挑选最能代表用户品味的歌曲。

${extractSection(__promptsRaw, "selection")}

⚠️ 只返回一行完整 JSON，recommendedSongIndices 必须包含目标数量的索引（25-35 个，或歌曲<100首时 15-20 个）：
{"selectionRationale":"...","recommendedSongIndices":[0,1,3,5,7,10,12,15,18,20,22,25,28,30,32,35,38,40,42,45,48,50,52,55,58,60,62,65,68,70]}`;

const BATCH_ANALYSIS_PROMPT = extractSection(__promptsRaw, "batch") + `\n\n⚠️ 只返回一行 JSON，recommendedSongIndices 必须包含 15-20 个索引：{"batchSummary":"...","genreTags":["华语流行"],"moodTags":["浪漫"],"eraTags":["2020年代"],"languageTags":["中文"],"recommendedSongIndices":[0,1,3,5,7,10,12,15,18,20,22,25,28,30,32,35,38,40],"selectionNotes":{"0":"入选理由"}}`;

const SYNTHESIS_PROMPT = extractSection(__promptsRaw, "synthesis") + `\n\n⚠️ 只返回一行 JSON，recommendedSongIndices 必须包含 30-50 个索引：{"styleProfile":"...","tasteClusters":[{"name":"...","percentage":35,"description":"...","keyArtists":["..."]}],"genreTags":["华语流行(40%)"],"moodTags":["治愈(30%)"],"eraTags":["2020年代(55%)"],"languageTags":["中文(75%)"],"favoritePatterns":"...","recommendedSongIndices":[0,1,3,5,7,10,12,15,18,20,22,25,28,30,32,35,38,40,42,45,48,50,52,55,58,60,62,65,68,70,72,75,78,80]}`;

const require = createRequire(import.meta.url);
type ApiFn = (opts: Record<string, unknown>) => Promise<{ body: unknown }>;
const {
  playlist_track_all,
  playlist_create,
  playlist_tracks,
  playlist_delete,
  playlist_detail,
  likelist,
  user_playlist,
  user_record,
  user_account,
  personalized,
  personalized_newsong,
  recommend_songs,
} = require("NeteaseCloudMusicApi");

// ── types ──

interface SongMeta {
  id: string;
  name: string;
  artist: string;
  album: string;
}

interface TasteCluster {
  name: string;
  percentage: number;
  description: string;
  keyArtists: string[];
}

interface TasteProfile {
  styleProfile: string;
  tasteClusters: TasteCluster[];
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  favoritePatterns: string;
}

interface SongSelection {
  selectionRationale: string;
  recommendedSongIndices: number[];
}

// ── helpers ──

function getCookie(): string | undefined {
  return config.netease.cookie || undefined;
}

function toNumeric(id: string): number {
  if (/^[0-9a-fA-F]{32}$/.test(id)) return parseInt(id, 16);
  return Number(id);
}

function mapSongMeta(raw: Record<string, unknown>): SongMeta {
  const id = String(raw.id ?? "");
  const name = String(raw.name ?? "");
  const ar = raw.ar as Array<{ name?: string }> | undefined;
  const artist = ar?.map((a) => a.name).filter(Boolean).join(" / ") ?? "";
  const al = raw.al as { name?: string } | undefined;
  const album = al?.name ?? "";
  return { id, name, artist, album };
}

/** Format a song list for AI consumption: "idx. 《歌名》— 歌手 ·《专辑》" */
function formatSongList(songs: SongMeta[]): string {
  return songs
    .map((s, i) => {
      const albumPart = s.album ? ` ·《${s.album}》` : "";
      return `${i}. 《${s.name}》 — ${s.artist || "未知歌手"}${albumPart}`;
    })
    .join("\n");
}

/** Fetch ALL tracks from a playlist, with retry + batch size fallback */
async function fetchPlaylistTracks(
  playlistId: number,
): Promise<Record<string, unknown>[]> {
  for (const pageSize of [800, 200]) {
    const songs = await fetchWithPagination(playlistId, pageSize);
    if (songs.length > 0) return songs;
    if (pageSize > 200) console.warn(`[analyze] playlist ${playlistId}: pageSize ${pageSize} failed, trying 200...`);
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

/** Fetch the current user's liked (红心) song IDs as a Set of numeric-ID strings */
async function fetchLikedSongIds(): Promise<Set<string>> {
  const cookie = getCookie();
  if (!cookie) return new Set();

  try {
    const result = await likelist({ cookie });
    const body = result.body as { code?: number; ids?: number[] };
    if (body.code === 200 && body.ids?.length) {
      return new Set(body.ids.map((id) => String(id)));
    }
  } catch (e) {
    console.warn("[analyze] Failed to fetch liked songs for filtering:", e);
  }
  return new Set();
}

/** Fetch the user's listening history song IDs (all-time + weekly) as a Set of numeric-ID strings */
async function fetchHistorySongIds(uid: string): Promise<Set<string>> {
  const cookie = getCookie();
  if (!cookie || !uid) return new Set();

  const heard = new Set<string>();
  // Try both weekly (type=1) and all-time (type=0)
  for (const type of [1, 0]) {
    try {
      const result = await user_record({ uid, type, cookie });
      const body = result.body as {
        code?: number;
        weekData?: Array<{ playCount: number; song: { id?: number } }>;
        allData?: Array<{ playCount: number; song: { id?: number } }>;
      };
      const items = (type === 1 ? body.weekData : body.allData) || [];
      for (const item of items) {
        if (item.song?.id) heard.add(String(item.song.id));
      }
    } catch (e) {
      console.warn(`[analyze] Failed to fetch history (type=${type}):`, e);
    }
  }
  return heard;
}

/**
 * Fetch ALL song IDs from ALL user playlists (except the source PANGY playlist).
 * Songs in any of the user's playlists are songs they definitely know.
 * Uses playlist_detail (lightweight — returns only trackIds, not full track data).
 */
async function fetchPlaylistSongIds(
  playlists: Array<{ id: number; name: string; trackCount: number }>,
  excludePlaylistId: number,
): Promise<Set<string>> {
  const cookie = getCookie();
  if (!cookie) return new Set();

  try {
    const known = new Set<string>();
    // Sort by trackCount desc to prioritize large playlists
    const sorted = [...playlists]
      .filter((pl) => pl.id !== excludePlaylistId)
      .sort((a, b) => (b.trackCount || 0) - (a.trackCount || 0));

    let scanned = 0;
    let skipped = 0;

    for (const pl of sorted) {
      if (scanned >= 20) break; // Limit to 20 playlists to avoid rate limiting
      try {
        const result = await playlist_detail({ id: pl.id, s: 0, cookie });
        const body = result.body as {
          code?: number;
          playlist?: { trackIds?: Array<{ id: number }> };
        };
        if (body.code === 200 && body.playlist?.trackIds) {
          for (const t of body.playlist.trackIds) {
            known.add(String(t.id));
          }
          scanned++;
          console.log(`[analyze] Playlist "${pl.name}": ${body.playlist.trackIds.length} tracks added to known set`);
        }
    } catch (e) {
      skipped++;
      console.warn(`[analyze] Failed to fetch playlist "${pl.name}" tracks:`, e);
    }
  }

  console.log(`[analyze] Playlist scan complete: ${scanned} scanned, ${skipped} skipped, ${known.size} known song IDs`);
  return known;
  } catch (e) {
    console.warn("[analyze] Playlist scan failed entirely:", e);
    return new Set();
  }
}

/** Try to repair truncated JSON by completing missing braces/brackets */
function repairJson(jsonStr: string): string {
  let s = jsonStr.trim();
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
  if (inString) s += '"';
  while (bracketDepth > 0) { s += "]"; bracketDepth--; }
  while (braceDepth > 0) { s += "}"; braceDepth--; }
  return s;
}

/** Parse AI response text into a generic object, with progressive repair attempts */
function parseAIResponse<T>(responseText: string): T {
  let jsonStr = responseText.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  const attempts: string[] = [
    jsonStr,
    repairJson(jsonStr),
  ];

  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(jsonStr.slice(firstBrace, lastBrace + 1));
    attempts.push(repairJson(jsonStr.slice(firstBrace, lastBrace + 1)));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch {
      // try next
    }
  }

  console.error("[analyze] All JSON parse attempts failed. Raw response (first 800 chars):",
    responseText.slice(0, 800));
  throw new Error(`AI 返回格式异常，请重试`);
}

/** Make a request to the DeepSeek API */
async function callAI(systemPrompt: string, userMessage: string, maxTokens = 16384): Promise<string> {
  const url = `${config.deepseek.baseUrl}/v1/messages`;

  const body = {
    model: config.deepseek.model,
    max_tokens: maxTokens,
    system: systemPrompt,
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
  return responseText;
}

// ── Pass 1: Taste Profile ──

async function callTasteProfileAI(songs: SongMeta[]): Promise<TasteProfile> {
  const songListText = formatSongList(songs);
  const userMessage = `分析以下 ${songs.length} 首歌的音乐品味：\n\n${songListText}`;

  console.log(`[analyze] Pass 1 — Taste Profile: ${songs.length} songs`);
  const responseText = await callAI(TASTE_PROFILE_PROMPT, userMessage, 16384);

  const parsed = parseAIResponse<TasteProfile & { recommendedSongIndices?: number[] }>(responseText);

  // Validate required fields
  if (!parsed.styleProfile && !parsed.tasteClusters) {
    throw new Error("AI 未返回有效的品味画像");
  }

  return {
    styleProfile: parsed.styleProfile || "",
    tasteClusters: Array.isArray(parsed.tasteClusters) ? parsed.tasteClusters : [],
    genreTags: Array.isArray(parsed.genreTags) ? parsed.genreTags : [],
    moodTags: Array.isArray(parsed.moodTags) ? parsed.moodTags : [],
    eraTags: Array.isArray(parsed.eraTags) ? parsed.eraTags : [],
    languageTags: Array.isArray(parsed.languageTags) ? parsed.languageTags : [],
    favoritePatterns: parsed.favoritePatterns || "",
  };
}

// ── Pass 2: Song Selection ──

async function callSongSelectionAI(
  songs: SongMeta[],
  profile: TasteProfile,
): Promise<SongSelection> {
  // Format the profile as structured text
  const clusterText = profile.tasteClusters.length > 0
    ? profile.tasteClusters
        .map((c) => `  - ${c.name} (~${c.percentage}%): ${c.description} [关键艺人: ${c.keyArtists.join(", ")}]`)
        .join("\n")
    : "（未识别出明显聚类）";

  const profileText = [
    `风格画像: ${profile.styleProfile}`,
    `品味聚类:\n${clusterText}`,
    `流派分布: ${profile.genreTags.join(", ")}`,
    `情绪倾向: ${profile.moodTags.join(", ")}`,
    `年代分布: ${profile.eraTags.join(", ")}`,
    `语言分布: ${profile.languageTags.join(", ")}`,
    `偏好特征: ${profile.favoritePatterns}`,
  ].join("\n");

  const songListText = formatSongList(songs);

  const targetCount = songs.length < 100 ? "15-20" : "25-35";
  const userMessage = [
    `## 品味画像`,
    profileText,
    "",
    `## 歌曲列表（共 ${songs.length} 首）`,
    songListText,
    "",
    `请从以上 ${songs.length} 首中精选 ${targetCount} 首最能代表该品味的歌曲。⚠️ 重要：recommendedSongIndices 数组必须包含 ${targetCount} 个索引，不要少于这个数量。`,
  ].join("\n");

  console.log(`[analyze] Pass 2 — Song Selection: ${songs.length} songs, target ${targetCount}`);
  const responseText = await callAI(SONG_SELECTION_PROMPT, userMessage, 16384);

  const parsed = parseAIResponse<SongSelection>(responseText);

  if (!Array.isArray(parsed.recommendedSongIndices)) {
    throw new Error("AI 未返回有效的歌曲精选");
  }

  const validIndices = parsed.recommendedSongIndices.filter(
    (i) => typeof i === "number" && i >= 0 && i < songs.length
  );

  const expectedMin = songs.length < 100 ? 15 : 25;
  if (validIndices.length < expectedMin) {
    console.warn(`[analyze] ⚠️ Song selection returned only ${validIndices.length} songs (expected ${expectedMin}+). AI may need stronger prompting.`);
  }

  return {
    selectionRationale: parsed.selectionRationale || "",
    recommendedSongIndices: validIndices,
  };
}

// ── batch analysis ──

interface BatchResult {
  batchSummary: string;
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  recommendedSongs: SongMeta[];
  selectionNotes: Record<string, string>;
}

/** Analyze a single batch of songs */
async function analyzeBatch(
  songs: SongMeta[],
  batchIndex: number,
  totalBatches: number,
): Promise<BatchResult> {
  const songListText = formatSongList(songs);

  const body = {
    model: config.deepseek.model,
    max_tokens: 8192,
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

  const parsed = parseAIResponse<{
    batchSummary?: string;
    genreTags?: string[];
    moodTags?: string[];
    eraTags?: string[];
    languageTags?: string[];
    recommendedSongIndices?: number[];
    selectionNotes?: Record<string, string>;
  }>(text);

  const indices = parsed.recommendedSongIndices || [];

  if (indices.length < 15) {
    console.warn(`[analyze] ⚠️ Batch ${batchIndex + 1} returned only ${indices.length} songs (expected 15-20). AI may need stronger prompting.`);
  }

  return {
    batchSummary: parsed.batchSummary || "",
    genreTags: parsed.genreTags || [],
    moodTags: parsed.moodTags || [],
    eraTags: parsed.eraTags || [],
    languageTags: parsed.languageTags || [],
    recommendedSongs: indices
      .filter((i) => typeof i === "number" && i >= 0 && i < songs.length)
      .map((i) => songs[i]),
    selectionNotes: parsed.selectionNotes || {},
  };
}

/** Synthesize results from all batches into a final analysis */
async function synthesizeResults(
  batchResults: BatchResult[],
  allRecommended: SongMeta[],
  selectionNotesMap: Map<string, string>,
): Promise<TasteProfile & { recommendedSongIndices: number[] }> {
  // Deduplicate recommended songs by ID
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
      tasteClusters: [],
      genreTags: [], moodTags: [], eraTags: [], languageTags: [],
      favoritePatterns: "",
      recommendedSongIndices: [],
    };
  }

  // Build rich context for synthesis: each batch's summary + tags
  const batchContexts = batchResults.map((b, i) => {
    return [
      `批次 ${i + 1} 分析摘要: ${b.batchSummary}`,
      `  流派: ${b.genreTags.join("、") || "未识别"}`,
      `  情绪: ${b.moodTags.join("、") || "未识别"}`,
      `  年代: ${b.eraTags.join("、") || "未识别"}`,
      `  语言: ${b.languageTags.join("、") || "未识别"}`,
    ].join("\n");
  }).join("\n\n");

  // Build the song pool with selection notes
  const songPoolText = uniqueSongs
    .map((s, i) => {
      const note = selectionNotesMap.get(s.id);
      const notePart = note ? ` [入选理由: ${note}]` : "";
      return `${i}. 《${s.name}》 — ${s.artist || "未知"}${s.album ? ` ·《${s.album}》` : ""}${notePart}`;
    })
    .join("\n");

  const userMessage = [
    `## 各批次分析结果`,
    batchContexts,
    "",
    `## 精选歌曲池（${uniqueSongs.length} 首，从所有批次汇总去重）`,
    songPoolText,
    "",
    `请综合以上信息，产出最终品味画像，并从歌曲池中精选 30-50 首。⚠️ 重要：recommendedSongIndices 数组必须包含 30-50 个索引，不要少于 30 个。`,
  ].join("\n");

  console.log(`[analyze] Synthesis: ${batchResults.length} batches, ${uniqueSongs.length} unique songs in pool`);

  const responseText = await callAI(SYNTHESIS_PROMPT, userMessage, 16384);

  const parsed = parseAIResponse<TasteProfile & { recommendedSongIndices?: number[] }>(responseText);

  const validIndices = (parsed.recommendedSongIndices || [])
    .filter((i) => typeof i === "number" && i >= 0 && i < uniqueSongs.length);

  if (validIndices.length < 30) {
    console.warn(`[analyze] ⚠️ Synthesis returned only ${validIndices.length} songs (expected 30-50). AI may need stronger prompting.`);
  }

  return {
    styleProfile: parsed.styleProfile || "",
    tasteClusters: Array.isArray(parsed.tasteClusters) ? parsed.tasteClusters : [],
    genreTags: Array.isArray(parsed.genreTags) ? parsed.genreTags : [],
    moodTags: Array.isArray(parsed.moodTags) ? parsed.moodTags : [],
    eraTags: Array.isArray(parsed.eraTags) ? parsed.eraTags : [],
    languageTags: Array.isArray(parsed.languageTags) ? parsed.languageTags : [],
    favoritePatterns: parsed.favoritePatterns || "",
    recommendedSongIndices: validIndices,
  };
}

// ── Full single-pass analysis (two-step for < 400 songs) ──

async function analyzeSinglePass(
  allMetas: SongMeta[],
): Promise<{
  styleProfile: string;
  tasteClusters: TasteCluster[];
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
  // Step 1: Taste Profiling
  console.log(`[analyze] Single pass Step 1/2 — Taste Profile: ${allMetas.length} songs`);
  const profile = await callTasteProfileAI(allMetas);

  // Step 2: Song Selection based on profile
  console.log(`[analyze] Single pass Step 2/2 — Song Selection`);
  const selection = await callSongSelectionAI(allMetas, profile);

  const recommendedSongs = selection.recommendedSongIndices
    .map((i) => allMetas[i])
    .filter(Boolean);

  console.log(`[analyze] Single pass complete: ${recommendedSongs.length} songs selected from ${allMetas.length}`);

  return {
    styleProfile: profile.styleProfile,
    tasteClusters: profile.tasteClusters,
    genreTags: profile.genreTags,
    moodTags: profile.moodTags,
    eraTags: profile.eraTags,
    languageTags: profile.languageTags,
    favoritePatterns: profile.favoritePatterns,
    recommendedSongs,
    totalSongs: allMetas.length,
    analyzedSongs: allMetas.length,
    batches: 1,
  };
}

// ── Full batch analysis: batches → synthesize ──

async function analyzeInBatches(
  allMetas: SongMeta[],
  batchSize: number,
): Promise<{
  styleProfile: string;
  tasteClusters: TasteCluster[];
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

  // Collect all recommended songs + their selection notes
  const allRecommended: SongMeta[] = [];
  const selectionNotesMap = new Map<string, string>();

  for (const br of batchResults) {
    for (let i = 0; i < br.recommendedSongs.length; i++) {
      const song = br.recommendedSongs[i];
      // Use the original index in the batch to look up selection notes
      const note = br.selectionNotes[String(i)] || br.selectionNotes[i] || "";
      if (note && !selectionNotesMap.has(song.id)) {
        selectionNotesMap.set(song.id, note);
      }
    }
    allRecommended.push(...br.recommendedSongs);
  }

  // Phase 2: synthesize
  broadcastEvent("analysis:progress", {
    phase: "synthesis",
    current: 0,
    total: 1,
    message: `综合分析 ${batchResults.length} 批结果 (${new Set(allRecommended.map(s => s.id)).size} 首精选)...`,
  });
  console.log(`[analyze] Synthesizing ${batchResults.length} batches, ${allRecommended.length} recommended songs (${selectionNotesMap.size} with notes)`);
  const synthesis = await synthesizeResults(batchResults, allRecommended, selectionNotesMap);

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
    tasteClusters: synthesis.tasteClusters,
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

    // 5. Analyze — batch mode for large lists, two-step single pass for small ones
    const BATCH_SIZE = 400;
    const useBatch = allMetas.length > BATCH_SIZE;

    console.log(`[analyze] Mode: ${useBatch ? "batch" : "single"}, ${allMetas.length} songs`);

    let finalAnalysis: {
      styleProfile: string;
      tasteClusters: TasteCluster[];
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
      finalAnalysis = await analyzeInBatches(allMetas, BATCH_SIZE);
    } else {
      finalAnalysis = await analyzeSinglePass(allMetas);
    }

    // Filter out songs already in the user's liked (红心) playlist
    let filteredCount = 0;
    try {
      const likedIds = await fetchLikedSongIds();
      if (likedIds.size > 0) {
        const before = finalAnalysis.recommendedSongs.length;
        finalAnalysis.recommendedSongs = finalAnalysis.recommendedSongs.filter(
          (s) => !likedIds.has(s.id)
        );
        filteredCount = before - finalAnalysis.recommendedSongs.length;
        if (filteredCount > 0) {
          console.log(`[analyze] Excluded ${filteredCount} liked songs from recommendations (${finalAnalysis.recommendedSongs.length} remaining)`);
        }
      }
    } catch (e) {
      console.warn("[analyze] Failed to filter liked songs:", e);
    }

    return res.json({
      success: true,
      data: {
        styleProfile: finalAnalysis.styleProfile,
        tasteClusters: finalAnalysis.tasteClusters,
        genreTags: finalAnalysis.genreTags,
        moodTags: finalAnalysis.moodTags,
        eraTags: finalAnalysis.eraTags,
        languageTags: finalAnalysis.languageTags,
        favoritePatterns: finalAnalysis.favoritePatterns,
        recommendedSongs: finalAnalysis.recommendedSongs,
        filteredLikedSongs: filteredCount,
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

/**
 * POST /api/analyze/work-playlist
 * One-click: find "PANGY" playlist → analyze → create/replace "上班听" playlist (~12h)
 */
analyzeRouter.post("/work-playlist", async (_req, res, next) => {
  try {
    const cookie = getCookie();
    if (!cookie) {
      return res.json({ success: false, error: "未登录，请先登录网易云音乐" });
    }

    if (!config.deepseek.apiKey) {
      return res.json({ success: false, error: "未配置 AI API Key" });
    }

    // ── Step 1: Find "PANGY" playlist ──
    broadcastEvent("analysis:progress", { phase: "search", current: 0, total: 1, message: "正在查找 PANGY 歌单..." });

    const plResult = await user_playlist({ uid: await getOrFetchUid(cookie), cookie });
    const plBody = plResult.body as { code?: number; playlist?: Array<{ id: number; name: string; trackCount: number }> };
    const playlists = plBody.playlist || [];

    const pangyPlaylist = playlists.find(
      (pl: { name: string }) => pl.name.toLowerCase().trim() === "pangy"
    );
    if (!pangyPlaylist) {
      return res.json({ success: false, error: "未找到名为 PANGY 的歌单，请先在网易云创建该歌单" });
    }

    console.log(`[work-playlist] Found PANGY playlist: id=${pangyPlaylist.id}, tracks=${pangyPlaylist.trackCount}`);

    // ── Step 2: Fetch all tracks from PANGY ──
    broadcastEvent("analysis:progress", { phase: "fetch", current: 0, total: 1, message: "正在获取 PANGY 歌单的全部歌曲..." });

    const tracks = await fetchPlaylistTracks(pangyPlaylist.id);
    if (tracks.length === 0) {
      return res.json({ success: false, error: "PANGY 歌单中没有歌曲" });
    }

    const allMetas = tracks.map(mapSongMeta);
    const totalDurationMs = tracks.reduce((sum, t) => sum + (Number(t.dt) || 0), 0);
    const totalDurationMin = Math.round(totalDurationMs / 60000);
    const totalDurationHr = (totalDurationMs / 3600000).toFixed(1);

    console.log(`[work-playlist] PANGY has ${allMetas.length} songs, total duration: ${totalDurationHr}h`);

    // ── Step 2.5: Fetch heard songs (history + liked + all playlists) to exclude ──
    broadcastEvent("analysis:progress", { phase: "filter", current: 0, total: 1, message: "正在排除已听过的歌曲..." });

    const uid = await getOrFetchUid(cookie);
    const [likedIds, historyIds, playlistSongIds] = await Promise.all([
      fetchLikedSongIds(),
      fetchHistorySongIds(uid),
      fetchPlaylistSongIds(playlists as Array<{ id: number; name: string; trackCount: number }>, pangyPlaylist.id),
    ]);
    const heardIds = new Set([...likedIds, ...historyIds, ...playlistSongIds]);

    console.log(`[work-playlist] Known-song filter built: liked=${likedIds.size}, history=${historyIds.size}, playlists=${playlistSongIds.size} → ${heardIds.size} total known IDs`);

    // ── Step 3: Run AI analysis ──
    broadcastEvent("analysis:progress", { phase: "analyze", current: 0, total: 2, message: "AI 正在分析你的音乐品味..." });

    let analysisResult: {
      styleProfile: string;
      tasteClusters: TasteCluster[];
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

    if (allMetas.length > 400) {
      analysisResult = await analyzeInBatches(allMetas, 400);
    } else {
      analysisResult = await analyzeSinglePass(allMetas);
    }

    broadcastEvent("analysis:progress", { phase: "discover", current: 0, total: 1, message: "正在从网易云发现你没听过的新歌..." });

    // ── Step 4: Discover NEW songs from Netease recommendations ──
    // Instead of recycling songs from PANGY (which are all known to the user),
    // use the taste profile to find new songs the user has never heard.
    const discoveredIds = new Set<string>();
    const discoveredSongs: Record<string, unknown>[] = [];

    // Helper: add songs to discovery pool (dedup + exclude known)
    const addDiscovered = (songs: Record<string, unknown>[]) => {
      for (const s of songs) {
        const sid = String(s.id ?? "");
        if (!sid || discoveredIds.has(sid) || heardIds.has(sid)) continue;
        discoveredIds.add(sid);
        discoveredSongs.push(s);
      }
    };

    // 4a: Fetch tracks from personalized recommended playlists (top 8)
    broadcastEvent("analysis:progress", { phase: "discover", current: 0, total: 3, message: "正在获取推荐歌单..." });
    try {
      const persResult = await (personalized as ApiFn)({ cookie, limit: 30 });
      const persBody = persResult.body as { code?: number; result?: Array<Record<string, unknown>> };
      if (persBody.code === 200 && persBody.result) {
        // Pick top playlists by playCount, excluding ones user already has
        const existingIds = new Set(playlists.map((p: { id: number }) => p.id));
        const newPlaylists = persBody.result
          .filter((pl: Record<string, unknown>) => !existingIds.has(pl.id as number))
          .sort((a, b) => (b.playCount as number || 0) - (a.playCount as number || 0))
          .slice(0, 8);

        console.log(`[work-playlist] Fetching tracks from ${newPlaylists.length} new recommended playlists`);
        for (const pl of newPlaylists) {
          const plId = pl.id as number;
          const plName = pl.name as string;
          try {
            const plTracks = await fetchPlaylistTracks(plId);
            addDiscovered(plTracks);
            console.log(`[work-playlist]   "${plName}": ${plTracks.length} tracks → pool now ${discoveredSongs.length}`);
          } catch (e) {
            console.warn(`[work-playlist] Failed to fetch playlist "${plName}":`, e);
          }
        }
      }
    } catch (e) {
      console.warn("[work-playlist] Failed to get personalized playlists:", e);
    }

    // 4b: Daily recommend songs
    broadcastEvent("analysis:progress", { phase: "discover", current: 1, total: 3, message: "正在获取每日推荐..." });
    try {
      const dailyResult = await (recommend_songs as ApiFn)({ cookie });
      const dailyBody = dailyResult.body as { code?: number; data?: { dailySongs?: Record<string, unknown>[] } };
      if (dailyBody.code === 200 && dailyBody.data?.dailySongs) {
        addDiscovered(dailyBody.data.dailySongs);
        console.log(`[work-playlist] Daily recommend: ${dailyBody.data.dailySongs.length} songs → pool now ${discoveredSongs.length}`);
      }
    } catch (e) {
      console.warn("[work-playlist] Failed to get daily recommendations:", e);
    }

    // 4c: New song recommendations
    broadcastEvent("analysis:progress", { phase: "discover", current: 2, total: 3, message: "正在获取新歌推荐..." });
    try {
      const newResult = await (personalized_newsong as ApiFn)({ cookie, limit: 20 });
      const newBody = newResult.body as { code?: number; result?: Record<string, unknown>[] };
      if (newBody.code === 200 && newBody.result) {
        // personalized_newsong returns { id, name, song: { artists, album, ... }, picUrl }
        const songs = newBody.result.map((item: Record<string, unknown>) => {
          const song = (item.song || item) as Record<string, unknown>;
          return { ...song, id: song.id || item.id, name: song.name || item.name };
        });
        addDiscovered(songs);
        console.log(`[work-playlist] New songs: ${songs.length} → pool now ${discoveredSongs.length}`);
      }
    } catch (e) {
      console.warn("[work-playlist] Failed to get new song recommendations:", e);
    }

    console.log(`[work-playlist] Discovery complete: ${discoveredSongs.length} new songs found (excluded ${heardIds.size} known)`);

    // ── Step 5: Build ~12h playlist from discovered songs ──
    broadcastEvent("analysis:progress", { phase: "generate", current: 0, total: 1, message: "正在精选上班听歌单..." });

    const MAX_SONGS = 250;
    const selectedMetas = discoveredSongs.slice(0, MAX_SONGS).map(mapSongMeta);
    const finalDurationMs = discoveredSongs
      .slice(0, MAX_SONGS)
      .reduce((sum, t) => sum + (Number((t as Record<string, unknown>).dt) || 0), 0);
    const finalDurationHr = (finalDurationMs / 3600000).toFixed(1);

    console.log(`[work-playlist] Selected ${selectedMetas.length} new songs (~${finalDurationHr}h)`);

    // ── Step 6: Find & delete existing "上班听" playlist ──
    const workPlaylist = playlists.find(
      (pl: { name: string }) => pl.name === "上班听"
    );
    if (workPlaylist) {
      console.log(`[work-playlist] Deleting existing 上班听 playlist: ${workPlaylist.id}`);
      try {
        await playlist_delete({ id: workPlaylist.id, cookie });
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.warn("[work-playlist] Failed to delete existing playlist:", e);
      }
    }

    // ── Step 7: Create new "上班听" playlist ──
    const createResult = await createPlaylistViaApi("上班听", selectedMetas.map((s) => s.id), cookie);
    if (!createResult.success) {
      return res.json(createResult);
    }

    const resultData = createResult.data as { playlistId?: string; name?: string; trackCount?: number };

    broadcastEvent("analysis:progress", { phase: "done", current: 1, total: 1, message: "上班听歌单已生成！" });

    return res.json({
      success: true,
      data: {
        playlistId: resultData.playlistId,
        name: "上班听",
        trackCount: resultData.trackCount,
        totalDuration: `${finalDurationHr} 小时`,
        discoveredTotal: discoveredSongs.length,
        excludedKnownCount: heardIds.size,
        aiRecommendedCount: analysisResult.recommendedSongs.length,
        styleProfile: analysisResult.styleProfile,
        tasteClusters: analysisResult.tasteClusters,
        genreTags: analysisResult.genreTags,
        moodTags: analysisResult.moodTags,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Helper: fetch or resolve current user's numeric UID */
async function getOrFetchUid(cookie: string): Promise<string> {
  try {
    const r = await user_account({ cookie });
    const body = r.body as { code?: number; profile?: { userId?: number }; account?: { id?: number } };
    const uid = body?.profile?.userId || body?.account?.id;
    return uid ? String(uid) : "";
  } catch {
    return "";
  }
}

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
    console.log(`[analyze] Adding batch ${Math.floor(i / BATCH) + 1}: ${batch.length} songs, first IDs: ${batch.slice(0, 3).join(",")}`);

    try {
      const addResult = await playlist_tracks({
        op: "add",
        pid,
        tracks: batch.join(","),
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
