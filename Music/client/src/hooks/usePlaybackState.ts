import { useEffect, useRef } from "react";
import { onSocketEvent } from "../api/socket";
import { usePlaybackStore } from "../stores/playbackStore";
import { playbackApi } from "../api/client";
import type { PlaybackState } from "../types/ncm";

export function usePlaybackState(): void {
  const update = usePlaybackStore((s) => s.update);
  const volume = usePlaybackStore((s) => s.volume);
  const playing = usePlaybackStore((s) => s.playing);
  const songKey = usePlaybackStore((s) => s.song ? `${s.song.name}|${s.song.artist}` : null);
  const prevSongKey = useRef<string | null>(null);

  useEffect(() => {
    return onSocketEvent("playback:state", (data) => {
      update(data as PlaybackState);
    });
  }, [update]);

  // Sync UI volume to mpv when a new song starts playing
  useEffect(() => {
    if (playing && songKey && songKey !== prevSongKey.current) {
      playbackApi.volume(volume);
    }
    prevSongKey.current = songKey;
  }, [playing, songKey, volume]);
}
