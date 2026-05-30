export interface NcmResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PlaybackState {
  playing: boolean;
  song?: {
    name: string;
    artist: string;
    album: string;
    duration: number;
    position: number;
    encryptedId?: string;
    originalId?: number;
    coverUrl?: string;
  };
  volume: number;
  queue: unknown[];
}

export interface Song {
  name: string;
  id: string;
  encryptedId?: string;
  originalId?: number;
  artists: { name: string; id?: string }[];
  album: { name: string; id?: string; coverUrl?: string };
  duration: number;
  hasLyric?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  trackCount: number;
  playCount: number;
  creator: { nickname: string };
}

export interface SearchResults {
  songs?: Song[];
  playlists?: Playlist[];
  albums?: unknown[];
  artists?: unknown[];
}

export interface UserProfile {
  nickname: string;
  avatarUrl: string;
  level: number;
  signature: string;
}
