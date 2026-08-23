import { useState, useEffect } from "react";
import { ListOrdered } from "lucide-react";
import { playbackApi } from "../../api/client";
import LoadingSpinner from "../shared/LoadingSpinner";
import EmptyState from "../shared/EmptyState";
import type { QueueItem } from "../../types/ncm";

interface RawQueueEntry {
  index?: number;
  current?: boolean;
  label?: string;
  prefix?: string;
  name?: string;
  artist?: string;
}

function parseItem(raw: RawQueueEntry, fallbackIndex = 0): QueueItem {
  const directName = typeof raw.name === "string" ? raw.name.trim() : "";
  const directArtist = typeof raw.artist === "string" ? raw.artist.trim() : "";
  const label = raw.label ?? "";
  const idx = label.lastIndexOf(" - ");
  const name = directName || (idx > 0 ? label.slice(0, idx).trim() : label.trim());
  const artist = directArtist || (idx > 0 ? label.slice(idx + 3).trim() : "");
  return {
    index: typeof raw.index === "number" ? raw.index : fallbackIndex,
    name,
    artist,
    current: Boolean(raw.current),
    prefix: raw.prefix?.trim() ?? "",
  };
}

function extractQueue(data: unknown): QueueItem[] {
  if (Array.isArray(data)) {
    return data.map((entry, index) => parseItem(entry as RawQueueEntry, index));
  }
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const queueArr = d.queue as Array<RawQueueEntry> | undefined;
  if (Array.isArray(queueArr)) return queueArr.map((entry, index) => parseItem(entry, index));
  // Also support legacy nested response shapes.
  const inner = (d.data as Record<string, unknown>) ?? d;
  const arr = inner.queue as Array<RawQueueEntry> | undefined;
  if (Array.isArray(arr)) return arr.map((entry, index) => parseItem(entry, index));
  return [];
}

export default function QueueView() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    playbackApi.queue()
      .then((res) => setQueue(extractQueue(res.data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="加载播放队列..." />;

  const currentSong = queue.find((i) => i.current);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <ListOrdered className="w-5 h-5 text-accent-dim" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">播放队列</h1>
          <p className="text-xs text-text-dim mt-0.5">
            {queue.length} 首
            {currentSong && <span className="ml-1">· 正在播放：{currentSong.name}</span>}
          </p>
        </div>
      </div>

      {queue.length > 0 ? (
        <div className="space-y-0.5">
          {queue.map((item) => {
            const isCurrent = item.current;
            return (
              <div
                key={`${item.index}-${item.name}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl smooth border ${
                  isCurrent
                    ? "bg-accent/8 border-accent/20"
                    : "border-transparent hover:bg-accent/3"
                }`}
              >
                <span className={`w-6 text-xs text-right tabular-nums flex-shrink-0 ${
                  isCurrent ? "text-accent-dim font-semibold" : "text-text-dim/50"
                }`}>
                  {isCurrent && item.prefix ? item.prefix : item.index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${isCurrent ? "text-accent-dim font-medium" : "text-text"}`}>
                    {item.name}
                  </p>
                  <p className="text-xs text-text-dim truncate">{item.artist}</p>
                </div>
                {isCurrent && (
                  <span className="text-[10px] text-accent-dim/60 px-2 py-0.5 rounded-full bg-accent/8 border border-accent/15 flex-shrink-0">
                    正在播放
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ListOrdered className="w-12 h-12" />}
          title="播放队列为空"
          description="在搜索或歌单中添加歌曲后会自动加入队列"
        />
      )}
    </div>
  );
}
