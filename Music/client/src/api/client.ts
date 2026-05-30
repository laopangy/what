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

  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};

// Playback
export const playbackApi = {
  state: () => api.get("/playback/state"),
  playSong: (encryptedId?: string, originalId?: number) =>
    api.post("/playback/play-song", { encryptedId, originalId }),
  playPlaylist: (encryptedId?: string, originalId?: number) =>
    api.post("/playback/play-playlist", { encryptedId, originalId }),
  pause: () => api.post("/playback/pause"),
  resume: () => api.post("/playback/resume"),
  stop: () => api.post("/playback/stop"),
  next: () => api.post("/playback/next"),
  prev: () => api.post("/playback/prev"),
  seek: (seconds: number) => api.post("/playback/seek", { seconds }),
  volume: (level: number) => api.post("/playback/volume", { level }),
  queue: () => api.get("/playback/queue"),
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
  created: (limit?: number) => api.get(`/playlist/created?limit=${limit || 50}`),
  collected: (limit?: number) => api.get(`/playlist/collected?limit=${limit || 50}`),
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
};

// User
export const userApi = {
  profile: () => api.get("/user/profile"),
  history: (limit?: number) => api.get(`/user/history?limit=${limit || 100}`),
  liked: () => api.get("/user/liked"),
};

// Song
export const songApi = {
  lyric: (id: string) => api.get<{ lyric: string; transLyric?: string }>(`/song/${encodeURIComponent(id)}/lyric`),
  like: (id: string) => api.post(`/song/${encodeURIComponent(id)}/like`),
  dislike: (id: string) => api.post(`/song/${encodeURIComponent(id)}/dislike`),
};

// Theme
export const themeApi = {
  images: () => api.get<string[]>("/theme/images"),
};

