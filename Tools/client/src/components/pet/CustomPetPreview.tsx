import { useEffect, useRef, useState } from "react";
import { petApi } from "../../api/petApi";
import type { CustomPetAssetInput, CustomPetSummary, PetAction } from "../../types/pet";

const assetPromises = new Map<string, Promise<CustomPetAssetInput>>();

function loadAsset(pet: CustomPetSummary) {
  const key = `${pet.id}:${pet.updatedAt}`;
  const existing = assetPromises.get(key);
  if (existing) return existing;
  for (const cachedKey of assetPromises.keys()) {
    if (cachedKey.startsWith(`${pet.id}:`)) assetPromises.delete(cachedKey);
  }
  const promise = petApi.getCustomAsset(pet.id)
    .then((result) => result.asset)
    .catch((error: unknown) => {
      assetPromises.delete(key);
      throw error;
    });
  assetPromises.set(key, promise);
  return promise;
}

export default function CustomPetPreview({ pet, action, className }: { pet: CustomPetSummary; action: PetAction; className?: string }) {
  const [asset, setAsset] = useState<CustomPetAssetInput | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    setError(false);
    loadAsset(pet).then((value) => {
      if (!cancelled) setAsset(value);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [pet.id, pet.updatedAt]);

  if (error) return <div className={`${className ?? ""} grid place-items-center text-center text-xs text-red-100/80`}>自定义资源加载失败</div>;
  if (!asset) return <div className={`${className ?? ""} animate-pulse rounded-[38%] bg-white/[0.04]`} />;
  if (asset.mode === "sprite" && asset.animation) return <CustomSpritePreview asset={asset} action={action} className={className} />;
  return <img src={asset.imageDataUrl} alt={`${pet.name}预览`} draggable={false} className={`${className ?? ""} select-none object-contain`} />;
}

function CustomSpritePreview({ asset, action, className }: { asset: CustomPetAssetInput; action: PetAction; className?: string }) {
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
    const image = new Image();
    image.onload = () => {
      const animation = asset.animation;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (cancelled || !animation || !canvas || !context) return;
      const { columns, rows, fps, actionRows } = animation;
      const frameWidth = image.naturalWidth / columns;
      const frameHeight = image.naturalHeight / rows;
      const configuredFrameCount = Math.min(animation.frameCount ?? columns * rows, columns * rows);
      canvas.width = Math.round(frameWidth);
      canvas.height = Math.round(frameHeight);
      const rowByAction: Partial<Record<PetAction, number>> = {
        idle: 0, curious: 0, groom: 0, walk: 1, dragging: 1,
        "sleep-enter": 2, sleep: 2, wake: 2, happy: 3, stretch: 3,
      };
      let lastFrame = -1;
      let lastRow = -1;
      const draw = (now: number) => {
        if (cancelled) return;
        const selectedRow = actionRows ? Math.min(rows - 1, rowByAction[actionRef.current] ?? 0) : 0;
        const frameCount = actionRows ? columns : configuredFrameCount;
        const frame = Math.floor(((now - startedAtRef.current) / 1000) * fps) % frameCount;
        const column = actionRows ? frame : frame % columns;
        const row = actionRows ? selectedRow : Math.floor(frame / columns);
        if (frame !== lastFrame || row !== lastRow) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, column * frameWidth, row * frameHeight, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);
          lastFrame = frame;
          lastRow = row;
        }
        animationFrame = requestAnimationFrame(draw);
      };
      animationFrame = requestAnimationFrame(draw);
    };
    image.src = asset.imageDataUrl;
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [asset]);

  return <canvas ref={canvasRef} aria-label="自定义灵宠动作预览" className={`${className ?? ""} object-contain`} />;
}
