import { useEffect, useRef } from "react";
import type { LyricLine } from "../../types/ncm";

export default function LyricsPanel({
  lyrics, position,
}: {
  lyrics: LyricLine[];
  position: number;
  playing: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndex = findCurrentIndex(lyrics, position);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.children[currentIndex] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex]);

  if (lyrics.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-base text-text-dim/40">暂无歌词</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth pr-2">
      {/* Extra space at top so first line can scroll to center */}
      <div className="h-[40vh]" />
      {lyrics.map((line, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <p
            key={i}
            className={`text-base transition-all duration-500 px-3 py-2.5 ${
              isCurrent
                ? "text-accent-dim font-bold text-lg scale-105 origin-left"
                : isPast
                  ? "text-text-dim/35"
                  : "text-text-dim/60"
            }`}
          >
            {line.text}
          </p>
        );
      })}
      {/* Extra space at bottom so last line can scroll to center */}
      <div className="h-[40vh]" />
    </div>
  );
}

function findCurrentIndex(lyrics: LyricLine[], position: number): number {
  let idx = 0;
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time <= position) idx = i;
    else break;
  }
  return idx;
}
