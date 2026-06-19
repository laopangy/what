import { useEffect, useRef } from "react";
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
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // If we have a direct song ID (from TrackRow click), use it
    if (songId && fetchedRef.current !== songId) {
      fetchedRef.current = songId;
      setLyrics([]);
      fetchLyrics(songId).then((lines) => {
        if (!cancelled) setLyrics(lines);
      });
      return () => { cancelled = true; };
    }

    // If no song ID but we have a playing song (AI play), search by name+artist
    if (!songId && song) {
      const key = `${song.name}|${song.artist}`;
      if (fetchedRef.current === key) return;
      fetchedRef.current = key;
      setLyrics([]);

      searchApi.songs(`${song.name} ${song.artist}`, 5).then((res) => {
        if (cancelled) return;
        const data = res.data as Record<string, unknown> | undefined;
        if (!data) return;
        // Handle both old nested format { data: { records: [...] } }
        // and new flat format { records: [...] }
        const inner = (data.data ?? data) as Record<string, unknown>;
        const records = (inner?.records ?? []) as Array<Record<string, unknown>>;
        if (Array.isArray(records) && records.length > 0) {
          const best = records[0];
          const id = best.id ? String(best.id) : undefined;
          if (id) {
            fetchLyrics(id).then((lines) => {
              if (!cancelled) setLyrics(lines);
            });
          }
        }
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [songId, song?.name, song?.artist, setLyrics]);

  // Clear lyrics when song is gone
  useEffect(() => {
    if (!song) {
      fetchedRef.current = null;
      setLyrics([]);
    }
  }, [song, setLyrics]);

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
