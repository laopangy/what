const BASE = "/api";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (e) {
    return { success: false, error: `网络请求失败: ${(e as Error).message}` };
  }

  if (!res.ok && res.status >= 500) {
    const text = await res.text().catch(() => "");
    return { success: false, error: `服务器错误 (${res.status}): ${text.slice(0, 200)}` };
  }

  try {
    const json = await res.json();
    return json as ApiResponse<T>;
  } catch {
    // Empty or non-JSON response
    const text = await res.text().catch(() => "");
    return { success: false, error: text ? `响应异常: ${text.slice(0, 200)}` : "服务器返回空响应，请重试" };
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};

// Playback
export const playbackApi = {
  state: () => api.get("/playback/state"),
  playSong: (encryptedId?: string, originalId?: number, meta?: { name?: string; artist?: string; duration?: number }) =>
    api.post("/playback/play-song", { encryptedId, originalId, name: meta?.name, artist: meta?.artist, duration: meta?.duration }),
  playSongs: (songs: { encryptedId?: string; originalId?: number; name?: string; artist?: string; duration?: number }[]) =>
    api.post("/playback/play-songs", { songs }),
  playPlaylist: (encryptedId?: string, originalId?: number) =>
    api.post("/playback/play-playlist", { encryptedId, originalId }),
  pause: () => api.post("/playback/pause"),
  resume: () => api.post("/playback/resume"),
  stop: () => api.post("/playback/stop"),
  next: () => api.post("/playback/next"),
  prev: () => api.post("/playback/prev"),
  seek: (seconds: number) => api.post("/playback/seek", { seconds }),
  volume: (level: number) => api.post("/playback/volume", { level }),
  shuffle: () => api.post("/playback/shuffle"),
  loop: (mode: "none" | "single" | "list") => api.post("/playback/loop", { mode }),
  queue: () => api.get("/playback/queue"),
  queueRemove: (index: number) => api.post("/playback/queue/remove", { index }),
  queueAdd: (encryptedId?: string, originalId?: number, meta?: { name?: string; artist?: string }) =>
    api.post("/playback/queue/add", { encryptedId, originalId, name: meta?.name, artist: meta?.artist }),
};

// Search
export const searchApi = {
  songs: (q: string, limit?: number) =>
    api.get(`/search/songs?q=${encodeURIComponent(q)}&limit=${limit || 30}`),
  playlists: (q: string, limit?: number) =>
    api.get(`/search/playlists?q=${encodeURIComponent(q)}&limit=${limit || 30}`),
  albums: (q: string, limit?: number) =>
    api.get(`/search/albums?q=${encodeURIComponent(q)}&limit=${limit || 30}`),
  all: (q: string) => api.get(`/search/all?q=${encodeURIComponent(q)}`),
};

// Playlists
export const playlistApi = {
  created: (limit?: number, uid?: string) =>
    api.get(`/playlist/created?limit=${limit || 50}${uid ? `&uid=${uid}` : ""}`),
  collected: (limit?: number, uid?: string) =>
    api.get(`/playlist/collected?limit=${limit || 50}${uid ? `&uid=${uid}` : ""}`),
  detail: (id: string) => api.get(`/playlist/${encodeURIComponent(id)}`),
  tracks: (id: string, limit?: number) =>
    api.get(`/playlist/${encodeURIComponent(id)}/tracks?limit=${limit || 50}`),
  create: (name: string) => api.post("/playlist/create", { name }),
  addSongs: (playlistId: string, songIds: string[]) =>
    api.post("/playlist/add-songs", { playlistId, songIds }),
};

// Recommend
export const recommendApi = {
  daily: () => api.get("/recommend/daily"),
  fm: () => api.get("/recommend/fm"),
  personalized: (limit?: number) =>
    api.get(`/recommend/personalized?limit=${limit || 30}`),
};

// User
export const userApi = {
  profile: () => api.get("/user/profile"),
  history: (limit?: number) => api.get(`/user/history?limit=${limit || 100}`),
  liked: () => api.get("/user/liked"),
  loginStatus: () => api.get<{ loggedIn: boolean; nickname?: string }>("/user/login-status"),
  loginQr: () => api.post<{ qrKey: string; qrimg: string; message: string; alreadyLoggedIn?: boolean }>("/user/login-qr"),
  search: (nickname: string) =>
    api.get<{ userId: string; nickname: string; avatarUrl: string; followeds: number; signature: string }[]>(
      `/user/search?nickname=${encodeURIComponent(nickname)}`
    ),
  follows: (limit?: number, offset?: number) =>
    api.get<{
      users: { userId: string; nickname: string; avatarUrl: string; followeds: number; signature: string }[];
      more: boolean;
    }>(`/user/follows?limit=${limit || 50}&offset=${offset || 0}`),
};

// Song
export const songApi = {
  lyric: (id: string) => api.get<{ lyric: string; transLyric?: string }>(`/song/${encodeURIComponent(id)}/lyric`),
  like: (id: string) => api.post(`/song/${encodeURIComponent(id)}/like`),
  dislike: (id: string) => api.post(`/song/${encodeURIComponent(id)}/dislike`),
  isLiked: (id: string) => api.get<{ liked: boolean }>(`/song/${encodeURIComponent(id)}/is-liked`),
};

// Analyze
export const analyzeApi = {
  style: (playlistIds: string[]) =>
    api.post<{
      styleProfile: string;
      tasteClusters: { name: string; percentage: number; description: string; keyArtists: string[] }[];
      genreTags: string[];
      moodTags: string[];
      eraTags: string[];
      languageTags: string[];
      favoritePatterns: string;
      recommendedSongs: { id: string; name: string; artist: string; album: string }[];
      totalSongs: number;
      analyzedSongs: number;
      sampled: boolean;
      filteredLikedSongs: number;
    }>("/analyze/style", { playlistIds }),
  generatePlaylist: (name: string, songIds: string[]) =>
    api.post<{ playlistId: string; name: string; trackCount: number }>(
      "/analyze/generate-playlist",
      { name, songIds }
    ),
  workPlaylist: () =>
    api.post<{
      playlistId: string;
      name: string;
      trackCount: number;
      totalDuration: string;
      discoveredTotal: number;
      excludedKnownCount: number;
      aiRecommendedCount: number;
      styleProfile: string;
      tasteClusters: { name: string; percentage: number; description: string; keyArtists: string[] }[];
      genreTags: string[];
      moodTags: string[];
    }>("/analyze/work-playlist"),
};

// Theme
export const themeApi = {
  images: () => api.get<string[]>("/theme/images"),
};

