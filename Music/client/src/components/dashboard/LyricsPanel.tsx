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
    const container = containerRef.current;
    if (!container) return;
    const el = container.children[currentIndex + 1] as HTMLElement | undefined;
    if (el) {
      const top = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
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
      <div className="h-[45%] shrink-0" />
      {lyrics.map((line, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <p
            key={i}
            className={`text-[15px] lg:text-base leading-relaxed transition-all duration-500 px-3 py-1 ${
              isCurrent
                ? "text-accent-dim font-semibold text-lg lg:text-xl"
                : isPast
                  ? "text-white/24"
                  : "text-white/66"
            }`}
          >
            {line.text}
          </p>
        );
      })}
      {/* Extra space at bottom so last line can scroll to center */}
      <div className="h-[45%] shrink-0" />
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
