import { useEffect, useRef } from "react";
import type { PetAction, PetSpriteManifest } from "../../types/pet";

const ASSET_BASE = "http://localhost:3002";

type SpriteAssets = {
  manifest: PetSpriteManifest;
  images: Record<string, HTMLImageElement>;
};

const assetPromises = new Map<string, Promise<SpriteAssets>>();

function loadAssets(petId: string): Promise<SpriteAssets> {
  const existing = assetPromises.get(petId);
  if (existing) return existing;
  const promise = fetch(`${ASSET_BASE}/pet-assets/${encodeURIComponent(petId)}/manifest.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error("灵宠动画清单加载失败");
      const manifest = await response.json() as PetSpriteManifest;
      const entries = await Promise.all(Object.entries(manifest.sheets).map(([key, source]) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = () => resolve([key, image]);
          image.onerror = () => reject(new Error("灵宠动作图集加载失败"));
          image.src = `${ASSET_BASE}${source}`;
        }),
      ));
      return { manifest, images: Object.fromEntries(entries) };
    });
  assetPromises.set(petId, promise);
  return promise;
}

export default function PetSpriteCanvas({
  petId,
  action,
  direction,
  onError,
}: {
  petId: string;
  action: PetAction;
  direction: "left" | "right";
  onError: (message: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef(action);
  const directionRef = useRef(direction);
  const startedAtRef = useRef(performance.now());

  useEffect(() => {
    actionRef.current = action;
    startedAtRef.current = performance.now();
  }, [action]);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let lastKey = "";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    loadAssets(petId).then(({ manifest, images }) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) throw new Error("浏览器不支持 Canvas 2D");
      canvas.width = manifest.frameWidth;
      canvas.height = manifest.frameHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const draw = (now: number) => {
        if (cancelled) return;
        if (document.hidden) {
          animationFrame = requestAnimationFrame(draw);
          return;
        }
        const currentAction = actionRef.current;
        const clip = manifest.animations[currentAction] ?? manifest.animations.idle;
        const elapsed = reduceMotion.matches ? 0 : Math.max(0, now - startedAtRef.current);
        const rawIndex = Math.floor((elapsed / 1000) * clip.fps);
        const frameIndex = clip.loop ? rawIndex % clip.frames.length : Math.min(rawIndex, clip.frames.length - 1);
        const frame = clip.frames[frameIndex];
        const key = `${currentAction}:${frame}:${directionRef.current}`;
        if (key !== lastKey) {
          lastKey = key;
          const source = images[clip.sheet];
          const columns = Math.floor(source.naturalWidth / manifest.frameWidth);
          const sourceX = (frame % columns) * manifest.frameWidth;
          const sourceY = Math.floor(frame / columns) * manifest.frameHeight;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.save();
          if (directionRef.current === "left") {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
          }
          context.drawImage(
            source,
            sourceX,
            sourceY,
            manifest.frameWidth,
            manifest.frameHeight,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          context.restore();
        }
        animationFrame = requestAnimationFrame(draw);
      };
      animationFrame = requestAnimationFrame(draw);
    }).catch((error: unknown) => {
      if (!cancelled) onError(error instanceof Error ? error.message : "灵宠资源加载失败");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [onError, petId]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}
