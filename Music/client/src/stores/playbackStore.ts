import { create } from "zustand";
import type { PlaybackState, LyricLine } from "../types/ncm";

interface PlaybackStore extends PlaybackState {
  currentSongId: string | null;
  lyrics: LyricLine[];
  localPosition: number;
  lastUpdateTime: number;
  lastSeekTime: number;
  update: (state: PlaybackState) => void;
  tick: () => number;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void;
  setLyrics: (lines: LyricLine[]) => void;
  setCurrentSongId: (id: string | null) => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  playing: false,
  volume: 70,
  currentSongId: null,
  lyrics: [],
  localPosition: 0,
  lastUpdateTime: 0,
  lastSeekTime: 0,

  update: (state) => {
    const { lastSeekTime, localPosition, lastUpdateTime, song: currentSong, playing: wasPlaying } = get();
    const now = Date.now();

    // Detect song change: fully sync position from server
    const songChanged = currentSong?.name !== state.song?.name
      || currentSong?.artist !== state.song?.artist;

    // Compute where tick() thinks we are right now
    const computedNow = wasPlaying && currentSong
      ? Math.min(localPosition + (now - lastUpdateTime) / 1000, currentSong.duration)
      : localPosition;

    // Only accept server position if:
    // 1. Song changed (new song) — full sync
    // 2. Server position is ahead of our computed position (catches us up from lag)
    // 3. We just seeked and enough time has passed (server now has correct post-seek position)
    const seekWindow = now - lastSeekTime < 5000;
    const serverPos = state.song?.position ?? 0;

    let usePosition = computedNow;
    if (songChanged) {
      usePosition = serverPos;
    } else if (!seekWindow && serverPos > computedNow) {
      usePosition = serverPos;
    }

    // Never trust server volume — ncm-cli doesn't report mpv's actual volume
    // Preserve existing song info if server state doesn't include it (mpvController)
    set({
      playing: state.playing,
      song: state.song || currentSong,
      localPosition: usePosition,
      lastUpdateTime: now,
    });
  },

  tick: () => {
    const { playing, lastUpdateTime, localPosition, song } = get();
    if (!playing || !song) return localPosition;
    const elapsed = (Date.now() - lastUpdateTime) / 1000;
    const pos = Math.min(localPosition + elapsed, song.duration);
    return pos;
  },

  togglePlay: () => set((s) => {
    const now = Date.now();
    const currentPos = s.playing
      ? s.localPosition + (now - s.lastUpdateTime) / 1000
      : s.localPosition;
    return {
      playing: !s.playing,
      localPosition: currentPos,
      lastUpdateTime: now,
    };
  }),

  seekTo: (seconds) => {
    set({
      localPosition: seconds,
      lastUpdateTime: Date.now(),
      lastSeekTime: Date.now(),
    });
  },

  setVolume: (v) => set({ volume: v }),
  setLyrics: (lines) => set({ lyrics: lines }),
  setCurrentSongId: (id) => set({ currentSongId: id }),
}));
