import { useEffect, useRef } from "react";
import type { PetAction, PetSpriteManifest } from "../../types/pet";

type Assets = { manifest: PetSpriteManifest; images: Record<string, HTMLImageElement> };
const assetPromises = new Map<string, Promise<Assets>>();

function loadAssets(petId: string): Promise<Assets> {
  const existing = assetPromises.get(petId);
  if (existing) return existing;
  const promise = fetch(`/pet-assets/${encodeURIComponent(petId)}/manifest.json`).then(async (response) => {
    if (!response.ok) throw new Error("动作资源加载失败");
    const manifest = await response.json() as PetSpriteManifest;
    const entries = await Promise.all(Object.entries(manifest.sheets).map(([key, source]) =>
      new Promise<[string, HTMLImageElement]>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve([key, image]);
        image.onerror = () => reject(new Error("动作图集加载失败"));
        image.src = source;
      }),
    ));
    return { manifest, images: Object.fromEntries(entries) };
  });
  assetPromises.set(petId, promise);
  return promise;
}

export default function PetPreviewCanvas({ petId, action, className = "" }: { petId: string; action: PetAction; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef(action);
  const startedAtRef = useRef(performance.now());

  useEffect(() => {
    actionRef.current = action;
    startedAtRef.current = performance.now();
  }, [action]);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    let lastKey = "";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    loadAssets(petId).then(({ manifest, images }) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (cancelled || !canvas || !context) return;
      canvas.width = manifest.frameWidth;
      canvas.height = manifest.frameHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      const draw = (now: number) => {
        if (cancelled) return;
        const current = actionRef.current;
        const clip = manifest.animations[current] ?? manifest.animations.idle;
        const elapsed = reduceMotion.matches ? 0 : Math.max(0, now - startedAtRef.current);
        const raw = Math.floor((elapsed / 1000) * clip.fps);
        const index = clip.loop ? raw % clip.frames.length : Math.min(raw, clip.frames.length - 1);
        const frame = clip.frames[index];
        const key = `${current}:${frame}`;
        if (key !== lastKey) {
          lastKey = key;
          const image = images[clip.sheet];
          const columns = image.naturalWidth / manifest.frameWidth;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            image,
            (frame % columns) * manifest.frameWidth,
            Math.floor(frame / columns) * manifest.frameHeight,
            manifest.frameWidth,
            manifest.frameHeight,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        }
        animationFrame = requestAnimationFrame(draw);
      };
      animationFrame = requestAnimationFrame(draw);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [petId]);

  return <canvas ref={canvasRef} className={className} aria-label="灵宠动作预览" />;
}
