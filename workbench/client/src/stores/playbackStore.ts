import { create } from "zustand";

export interface SongInfo {
  name: string;
  artist: string;
  duration: number;
  position: number;
}

interface PlaybackState {
  playing: boolean;
  song: SongInfo | null;
  volume: number;
  update: (playing: boolean, song: SongInfo | null, volume: number) => void;
  togglePlaying: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  playing: false,
  song: null,
  volume: 70,
  update: (playing, song, volume) => set({ playing, song, volume }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
}));
