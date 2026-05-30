interface NcmStateRaw {
  status: string;
  title?: string;
  position: number;
  duration: number;
  volume: number | null;
  currentIndex?: number;
  queueLength?: number;
}

export interface NormalizedPlaybackState {
  playing: boolean;
  song?: {
    name: string;
    artist: string;
    duration: number;
    position: number;
  };
  volume: number;
  currentIndex?: number;
  queueLength?: number;
}

export function normalizeState(raw: unknown): NormalizedPlaybackState {
  const d = raw as Record<string, unknown>;
  const src = ((d?.state || d) as NcmStateRaw) ?? {};

  let name = "";
  let artist = "";
  if (src.title) {
    const idx = src.title.lastIndexOf(" - ");
    if (idx > 0) {
      name = src.title.slice(0, idx);
      artist = src.title.slice(idx + 3);
    } else {
      name = src.title;
    }
  }

  return {
    playing: src.status === "playing",
    song: name
      ? {
          name,
          artist,
          duration: src.duration || 0,
          position: src.position || 0,
        }
      : undefined,
    volume: typeof src.volume === "number" ? src.volume : 70,
    currentIndex: src.currentIndex,
    queueLength: src.queueLength,
  };
}
