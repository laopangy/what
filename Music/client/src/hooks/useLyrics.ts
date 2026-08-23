import { useEffect } from "react";
import { usePlaybackStore } from "../stores/playbackStore";
import { songApi, searchApi } from "../api/client";
import type { LyricLine } from "../types/ncm";

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/g;
  let match;
  while ((match = regex.exec(lrc)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseFloat(match[2]);
    const text = match[3].trim();
    if (text) {
      lines.push({ time: minutes * 60 + seconds, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function useLyrics(songId?: string) {
  const setLyrics = usePlaybackStore((s) => s.setLyrics);
  const lyrics = usePlaybackStore((s) => s.lyrics);
  const song = usePlaybackStore((s) => s.song);

  useEffect(() => {
    let cancelled = false;

    const loadLyrics = async () => {
      setLyrics([]);

      // Normal playback always carries the provider-aware song ID.
      if (songId) {
        const lines = await fetchLyrics(songId);
        if (!cancelled) setLyrics(lines);
        return;
      }

      // AI-triggered playback may only provide a title and artist.
      if (!song) return;
      try {
        const res = await searchApi.songs(`${song.name} ${song.artist}`, 5);
        if (cancelled) return;
        const data = res.data as Record<string, unknown> | undefined;
        if (!data) return;
        // Handle both old nested format { data: { records: [...] } }
        // and new flat format { records: [...] }
        const inner = (data.data ?? data) as Record<string, unknown>;
        const records = (inner?.records ?? []) as Array<Record<string, unknown>>;
        const best = records[0];
        const id = best?.id ? String(best.id) : undefined;
        if (!id) return;
        const lines = await fetchLyrics(id);
        if (!cancelled) setLyrics(lines);
      } catch {
        // Keep the empty state when search or lyric loading fails.
      }
    };

    void loadLyrics();

    return () => { cancelled = true; };
  }, [songId, song?.name, song?.artist, setLyrics]);

  return lyrics;
}

function fetchLyrics(id: string): Promise<LyricLine[]> {
  return songApi.lyric(id).then((res) => {
    if (res.success && res.data?.lyric) {
      return parseLrc(res.data.lyric);
    }
    return [];
  }).catch(() => []);
}
