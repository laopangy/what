export interface PlaybackState {
  playing: boolean;
  song?: {
    id?: string;
    name: string;
    artist: string;
    duration: number;
    position: number;
  };
  volume: number;
  currentIndex?: number;
  queueLength?: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface Song {
  name: string;
  id: string;
  encryptedId?: string;
  originalId?: number;
  artists: { name: string; id?: string }[];
  album: { name: string; id?: string; coverUrl?: string };
  duration: number;
}

export interface QueueItem {
  index: number;
  name: string;
  artist: string;
  current: boolean;
  prefix: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackCount?: number;
  playCount?: number;
  creator?: { nickname: string };
}
