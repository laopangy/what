import {
  checkQQLoginQr as checkQQLoginQrSdk,
  getLyric,
  getMusicPlay,
  getQQLoginQr as getQQLoginQrSdk,
  search,
} from "@sansenjian/qq-music-api/sdk";
import { songListDetail } from "@sansenjian/qq-music-api/services";
import { randomUUID } from "crypto";
import { config } from "../config.js";
import { clearEnvValue, musicEnvPath, setEnvValue } from "./envFile.js";

interface QQSinger {
  id?: number;
  mid?: string;
  name?: string;
}

interface QQSongRaw {
  songid?: number;
  songmid?: string;
  songname?: string;
  id?: number;
  mid?: string;
  name?: string;
  interval?: number;
  albummid?: string;
  albumname?: string;
  album?: { mid?: string; name?: string };
  media_mid?: string;
  strMediaMid?: string;
  file?: { media_mid?: string };
  singer?: QQSinger[];
}

interface QQMusicUChartResponse {
  code?: number;
  [key: string]: unknown;
}

interface QQMusicUResponse {
  [key: string]: {
    code?: number;
    data?: Record<string, unknown>;
  } | unknown;
}

interface QQSearchResponse {
  body?: {
    response?: {
      code?: number;
      data?: { song?: { list?: QQSongRaw[] } };
    };
  };
}

interface QQPlayResponse {
  body?: {
    data?: {
      playUrl?: Record<string, { url?: string; error?: string } | string>;
    };
  };
}

interface QQLyricResponse {
  body?: {
    response?: {
      lyric?: string;
      trans?: string;
    };
  };
}

interface QQLoginQrResponse {
  status?: number;
  body?: { img?: string; ptqrtoken?: number; qrsig?: string };
}

interface QQLoginCheckResponse {
  status?: number;
  body?: {
    isOk?: boolean;
    refresh?: boolean;
    message?: string;
    session?: { cookie?: string; loginUin?: string; uin?: string };
    error?: { message?: string } | string;
  };
}

const activeQQLoginSessions = new Map<string, { ptqrtoken: number; qrsig: string }>();

export interface QQSong {
  id: string;
  provider: "qq";
  providerId: string;
  qqMid: string;
  mediaMid: string;
  originalId?: number;
  name: string;
  duration: number;
  artists: Array<{ name: string; id?: string }>;
  album: { name: string; id?: string; coverUrl?: string };
  coverImgUrl?: string;
}

function coverUrl(albumMid?: string): string {
  return albumMid
    ? `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg?max_age=2592000`
    : "";
}

function normalizeQQSong(song: QQSongRaw): (QQSongRaw & { songmid: string }) | null {
  const songmid = song.songmid || song.mid;
  if (!songmid) return null;
  return {
    ...song,
    songmid,
    songid: song.songid || song.id,
    songname: song.songname || song.name,
    albummid: song.albummid || song.album?.mid,
    albumname: song.albumname || song.album?.name,
    media_mid: song.media_mid || song.file?.media_mid,
  };
}

function mapQQSong(song: QQSongRaw & { songmid: string }): QQSong {
  const image = coverUrl(song.albummid);
  return {
    id: `qq:${song.songmid}`,
    provider: "qq",
    providerId: song.songmid,
    qqMid: song.songmid,
    mediaMid: song.media_mid || song.strMediaMid || song.songmid,
    originalId: song.songid,
    name: song.songname || "未知歌曲",
    duration: (song.interval || 0) * 1000,
    artists: (song.singer || []).map((artist) => ({
      name: artist.name || "未知歌手",
      id: artist.mid || (artist.id ? String(artist.id) : undefined),
    })),
    album: {
      name: song.albumname || "",
      id: song.albummid,
      coverUrl: image,
    },
    coverImgUrl: image,
  };
}

export async function searchQQSongs(keyword: string, limit: number): Promise<QQSong[]> {
  const result = await search({ key: keyword, limit, page: 1 }) as QQSearchResponse;
  if (result.body?.response?.code !== 0) {
    throw new Error("QQ 音乐搜索失败");
  }

  return (result.body.response.data?.song?.list || [])
    .filter((song): song is QQSongRaw & { songmid: string } => Boolean(song.songmid))
    .map(mapQQSong);
}

export interface QQChart {
  id: string;
  name: string;
  coverUrl: string;
  tracks: QQSong[];
}

export async function getQQCharts(limit = 12): Promise<QQChart[]> {
  const charts = [
    { id: "26", fallbackName: "热歌榜" },
    { id: "4", fallbackName: "流行指数榜" },
    { id: "27", fallbackName: "新歌榜" },
  ];
  const requests = Object.fromEntries(charts.map(({ id }) => [
    `rank_${id}`,
    {
      module: "musicToplist.ToplistInfoServer",
      method: "GetDetail",
      param: { topId: Number(id), offset: 0, num: limit, period: "" },
    },
  ]));
  const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://y.qq.com/",
      },
      body: JSON.stringify({
        comm: { ct: 24, cv: 4747474, format: "json", uin: 0 },
        ...requests,
      }),
      signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`QQ 榜单请求失败 (${response.status})`);
  const body = await response.json() as QQMusicUChartResponse;
  return charts.map(({ id, fallbackName }) => {
    const rank = body[`rank_${id}`] as {
      code?: number;
      data?: {
        data?: { title?: string; name?: string; frontPicUrl?: string; headPicUrl?: string };
        topInfo?: { title?: string; name?: string; frontPicUrl?: string; headPicUrl?: string };
        songInfoList?: Array<QQSongRaw | { data?: QQSongRaw }>;
      };
    } | undefined;
    const data = rank?.data;
    const info = data?.data || data?.topInfo;
    const tracks = (data?.songInfoList || [])
      .map((item) => "data" in item && item.data ? item.data : item as QQSongRaw)
      .map(normalizeQQSong)
      .filter((song): song is QQSongRaw & { songmid: string } => Boolean(song))
      .map(mapQQSong);
    return {
      id,
      name: info?.title || info?.name || fallbackName,
      coverUrl: info?.frontPicUrl || info?.headPicUrl || tracks[0]?.album.coverUrl || "",
      tracks,
    };
  });
}

interface QQPlaylistRaw {
  dissid?: string | number;
  tid?: string | number;
  id?: string | number;
  dirid?: string | number;
  dissname?: string;
  diss_name?: string;
  title?: string;
  name?: string;
  picurl?: string;
  diss_cover?: string;
  pic_url?: string;
  logo?: string;
  cover?: string;
  songnum?: number;
  song_cnt?: number;
  num0?: number;
  listen_num?: number;
  visitnum?: number;
  type?: number;
}

export interface QQPlaylist {
  id: string;
  name: string;
  coverUrl: string;
  trackCount?: number;
  playCount?: number;
  kind: "liked" | "created" | "collected";
}

function mapQQPlaylist(raw: QQPlaylistRaw, kind: QQPlaylist["kind"]): QQPlaylist | null {
  const id = raw.dissid ?? raw.tid ?? raw.id ?? raw.dirid;
  if (id === undefined || id === null || String(id) === "0") return null;
  const trackCount = raw.songnum ?? raw.song_cnt ?? raw.num0;
  return {
    id: String(id),
    name: raw.dissname || raw.diss_name || raw.title || raw.name || "未命名歌单",
    coverUrl: raw.picurl || raw.pic_url || raw.diss_cover || raw.logo || raw.cover || "",
    trackCount: trackCount === undefined ? undefined : Number(trackCount),
    playCount: raw.listen_num === undefined && raw.visitnum === undefined
      ? undefined
      : Number(raw.listen_num ?? raw.visitnum),
    kind,
  };
}

async function fetchQQJson(url: URL): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      Cookie: config.qq.cookie,
      Referer: `https://y.qq.com/portal/profile.html?uin=${getQQLoginStatus().uin || ""}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`QQ 音乐账号请求失败 (${response.status})`);
  return await response.json() as Record<string, unknown>;
}

function parseQQCookie(): Record<string, string> {
  return Object.fromEntries(
    config.qq.cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator > 0
          ? [part.slice(0, separator), part.slice(separator + 1)]
          : [part, ""];
      }),
  );
}

function getQQMusicKey(): string {
  const cookie = parseQQCookie();
  return cookie.qm_keyst
    || cookie.qqmusic_key
    || cookie.music_key
    || cookie.p_skey
    || cookie.skey
    || cookie.wxskey
    || "";
}

async function fetchQQMusicU(
  requests: Record<string, { module: string; method: string; param: Record<string, unknown> }>,
  authenticated = false,
): Promise<QQMusicUResponse> {
  const account = getQQLoginStatus();
  const musicKey = authenticated ? getQQMusicKey() : "";
  const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: config.qq.cookie,
      Referer: "https://y.qq.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    },
    body: JSON.stringify({
      comm: {
        uin: account.uin || "0",
        format: "json",
        ct: musicKey ? 19 : 24,
        cv: 0,
        ...(musicKey ? { authst: musicKey } : {}),
      },
      ...requests,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`QQ 音乐请求失败 (${response.status})`);
  return await response.json() as QQMusicUResponse;
}

export async function getQQLibrary(): Promise<{
  liked?: QQPlaylist;
  created: QQPlaylist[];
  collected: QQPlaylist[];
}> {
  const { loggedIn, uin } = getQQLoginStatus();
  if (!loggedIn || !uin) return { created: [], collected: [] };

  const createdUrl = new URL("https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss");
  Object.entries({
    hostUin: "0", hostuin: uin, sin: "0", size: "200", g_tk: "5381",
    loginUin: uin, format: "json", inCharset: "utf8", outCharset: "utf-8",
    notice: "0", platform: "yqq.json", needNewCode: "0",
  }).forEach(([key, value]) => createdUrl.searchParams.set(key, value));

  const collectedUrl = new URL("https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg");
  Object.entries({
    ct: "20", cid: "205360956", userid: uin, reqtype: "3", sin: "0", ein: "80", format: "json", g_tk: "5381",
  }).forEach(([key, value]) => collectedUrl.searchParams.set(key, value));

  const [createdResult, collectedResult] = await Promise.allSettled([
    fetchQQJson(createdUrl),
    fetchQQJson(collectedUrl),
  ]);
  const createdPayload = createdResult.status === "fulfilled" ? createdResult.value : {};
  const createdData = (createdPayload.data || createdPayload) as Record<string, unknown>;
  const createdRaw = (createdData.disslist || createdData.list || []) as QQPlaylistRaw[];
  const likedRaw = createdRaw.find((item) => {
    const name = item.dissname || item.diss_name || item.title || item.name || "";
    return ["我喜欢", "我喜欢的音乐", "喜欢的音乐"].includes(name.trim()) || item.type === 1;
  });

  const collectedPayload = collectedResult.status === "fulfilled" ? collectedResult.value : {};
  const collectedData = (collectedPayload.data || collectedPayload) as Record<string, unknown>;
  const collectedRaw = (collectedData.cdlist || collectedData.list || collectedData.disslist || []) as QQPlaylistRaw[];

  return {
    liked: likedRaw ? mapQQPlaylist(likedRaw, "liked") || undefined : undefined,
    created: createdRaw
      .filter((item) => item !== likedRaw)
      .map((item) => mapQQPlaylist(item, "created"))
      .filter((item): item is QQPlaylist => Boolean(item)),
    collected: collectedRaw.map((item) => mapQQPlaylist(item, "collected")).filter((item): item is QQPlaylist => Boolean(item)),
  };
}

export async function getQQGuessYouLike(limit = 20): Promise<QQSong[]> {
  if (!getQQLoginStatus().loggedIn) return [];

  const seen = new Set<string>();
  const songs: QQSong[] = [];
  for (let attempt = 0; attempt < 4 && songs.length < limit; attempt += 1) {
    const response = await fetchQQMusicU({
      radio: {
        module: "music.radioProxy.MbTrackRadioSvr",
        method: "get_radio_track",
        param: {},
      },
    }, true);
    const radio = response.radio as { code?: number; data?: Record<string, unknown> } | undefined;
    if (radio?.code !== 0) break;
    const data = radio.data || {};
    const rawSongs = [data.track, data.songList, data.vec_song, data.tracks]
      .find((candidate) => Array.isArray(candidate)) as QQSongRaw[] | undefined;
    if (!rawSongs?.length) break;

    for (const raw of rawSongs) {
      const normalized = normalizeQQSong(raw);
      if (!normalized || seen.has(normalized.songmid)) continue;
      seen.add(normalized.songmid);
      songs.push(mapQQSong(normalized));
      if (songs.length >= limit) break;
    }
  }
  return songs;
}

export interface QQPlaylistDetail extends QQPlaylist {
  description?: string;
  creator?: string;
  tracks: QQSong[];
}

export async function getQQPlaylistDetail(id: string): Promise<QQPlaylistDetail> {
  const result = await songListDetail({
    method: "get",
    params: { disstid: id },
    option: config.qq.cookie ? { headers: { Cookie: config.qq.cookie } } : {},
  }) as {
    status?: number;
    body?: { response?: {
      code?: number;
      cdlist?: Array<QQPlaylistRaw & {
        desc?: string;
        nickname?: string;
        creator?: { name?: string; nickname?: string } | string;
        songlist?: QQSongRaw[];
      }>;
    }; error?: unknown };
  };
  const raw = result.body?.response?.cdlist?.[0];
  if (!raw || result.body?.response?.code !== 0) throw new Error("QQ 音乐歌单详情获取失败");
  const playlist = mapQQPlaylist(raw, "created");
  if (!playlist) throw new Error("QQ 音乐歌单信息无效");
  const tracks = (raw.songlist || [])
    .map(normalizeQQSong)
    .filter((song): song is QQSongRaw & { songmid: string } => Boolean(song))
    .map(mapQQSong);
  const creator = typeof raw.creator === "string"
    ? raw.creator
    : raw.creator?.nickname || raw.creator?.name || raw.nickname;
  return {
    ...playlist,
    trackCount: playlist.trackCount ?? tracks.length,
    description: raw.desc,
    creator,
    tracks,
  };
}

export async function getQQPlayUrl(songMid: string, mediaMid?: string): Promise<string | null> {
  const qualities = ["320", "128", "m4a"];
  for (const quality of qualities) {
    try {
      const result = await getMusicPlay({
        songmid: songMid,
        mediaId: mediaMid,
        quality,
        cookie: config.qq.cookie || undefined,
      }) as QQPlayResponse;
      const entry = result.body?.data?.playUrl?.[songMid];
      const url = typeof entry === "string" ? entry : entry?.url;
      if (url) return url;
    } catch {
      // Try the next quality when QQ rejects a single format.
    }
  }
  return null;
}

export async function getQQLyric(songMid: string): Promise<{ lyric: string; transLyric?: string }> {
  const result = await getLyric({
    songmid: songMid,
    isFormat: false,
    cookie: config.qq.cookie || undefined,
  }) as QQLyricResponse;
  const response = result.body?.response;
  return {
    lyric: response?.lyric || "[00:00.00]暂无歌词",
    transLyric: response?.trans || undefined,
  };
}

export function getQQLoginStatus(): { loggedIn: boolean; uin?: string } {
  const cookie = config.qq.cookie;
  const uin = cookie.match(/(?:^|;\s*)(?:uin|wxuin)=o?(\d+)/)?.[1];
  return { loggedIn: Boolean(cookie), uin };
}

export async function createQQLoginQr(): Promise<{
  qrKey: string;
  qrimg: string;
  message: string;
}> {
  const result = await getQQLoginQrSdk() as QQLoginQrResponse;
  const { img, ptqrtoken, qrsig } = result.body || {};
  if (!img || !ptqrtoken || !qrsig) throw new Error("无法获取 QQ 登录二维码");

  const qrKey = randomUUID();
  activeQQLoginSessions.set(qrKey, { ptqrtoken, qrsig });
  return { qrKey, qrimg: img, message: "使用手机 QQ 扫描二维码并确认登录" };
}

export async function checkQQLoginQr(qrKey: string): Promise<{
  status: "waiting" | "success" | "expired" | "error";
  message?: string;
  uin?: string;
}> {
  const session = activeQQLoginSessions.get(qrKey);
  if (!session) return { status: "error", message: "无效的二维码会话" };

  const result = await checkQQLoginQrSdk(session) as QQLoginCheckResponse;
  const body = result.body || {};
  if (body.refresh) {
    activeQQLoginSessions.delete(qrKey);
    return { status: "expired", message: body.message || "二维码已过期" };
  }
  if (!body.isOk) return { status: "waiting", message: body.message || "等待扫码" };

  const cookie = body.session?.cookie;
  if (!cookie) return { status: "error", message: "登录成功但未返回 Cookie" };
  activeQQLoginSessions.delete(qrKey);
  setEnvValue(musicEnvPath, "QQ_MUSIC_COOKIE", cookie);
  config.qq.cookie = cookie;
  return {
    status: "success",
    message: "QQ 音乐登录成功",
    uin: body.session?.uin || body.session?.loginUin,
  };
}

export function logoutQQMusic(): void {
  activeQQLoginSessions.clear();
  clearEnvValue(musicEnvPath, "QQ_MUSIC_COOKIE");
  config.qq.cookie = "";
}
