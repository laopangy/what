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
    const el = containerRef.current.children[currentIndex + 1] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, lyrics.length]);

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
    <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth px-2 text-center player-lyrics-scroll">
      {/* Extra space at top so first line can scroll to center */}
      <div className="h-[40vh]" />
      {lyrics.map((line, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <p
            key={i}
            className={`text-base lg:text-lg transition-all duration-500 px-3 py-2 ${
              isCurrent
                ? "text-accent-dim font-semibold text-xl lg:text-2xl scale-105"
                : isPast
                  ? "text-white/28"
                  : "text-white/58"
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
