import { useEffect, useRef, useState } from "react";
import { getCustomPetAsset } from "../../api/petApi";
import type { CustomPetAsset, CustomPetSummary, PetAction } from "../../types/pet";

const assetPromises = new Map<string, Promise<CustomPetAsset>>();

function loadAsset(petId: string, version: string): Promise<CustomPetAsset> {
  const key = `${petId}:${version}`;
  const existing = assetPromises.get(key);
  if (existing) return existing;
  for (const cachedKey of assetPromises.keys()) {
    if (cachedKey.startsWith(`${petId}:`)) assetPromises.delete(cachedKey);
  }
  const promise = getCustomPetAsset(petId)
    .then((result) => result.asset)
    .catch((error: unknown) => {
      assetPromises.delete(key);
      throw error;
    });
  assetPromises.set(key, promise);
  return promise;
}

export default function CustomPetRenderer({
  pet,
  action,
  direction,
  onError,
}: {
  pet: CustomPetSummary;
  action: PetAction;
  direction: "left" | "right";
  onError: (message: string) => void;
}) {
  const [asset, setAsset] = useState<CustomPetAsset | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    loadAsset(pet.id, pet.updatedAt)
      .then((value) => { if (!cancelled) setAsset(value); })
      .catch((error: unknown) => {
        if (!cancelled) onError(error instanceof Error ? error.message : "自定义灵宠资源加载失败");
      });
    return () => { cancelled = true; };
  }, [onError, pet.id, pet.updatedAt]);

  if (!asset) return <div className="h-full w-full animate-pulse rounded-[40%] bg-white/[0.035]" />;
  if (asset.mode === "sprite" && asset.animation) {
    return <CustomSpriteCanvas asset={asset} action={action} direction={direction} />;
  }

  return (
    <div className="h-full w-full" style={{ transform: direction === "left" ? "scaleX(-1)" : undefined }}>
      <img
        src={asset.imageDataUrl}
        alt=""
        draggable={false}
        className={`h-full w-full select-none object-contain ${asset.mode === "static" ? `pet-custom-static pet-custom-${action}` : ""}`}
      />
    </div>
  );
}

function CustomSpriteCanvas({ asset, action, direction }: { asset: CustomPetAsset; action: PetAction; direction: "left" | "right" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
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
    const image = new Image();
    image.onload = () => {
      if (cancelled || !asset.animation) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      imageRef.current = image;
      const { columns, rows, fps, actionRows } = asset.animation;
      const frameWidth = image.naturalWidth / columns;
      const frameHeight = image.naturalHeight / rows;
      const configuredFrameCount = Math.min(asset.animation.frameCount ?? columns * rows, columns * rows);
      canvas.width = Math.round(frameWidth);
      canvas.height = Math.round(frameHeight);
      const rowByAction: Partial<Record<PetAction, number>> = {
        idle: 0,
        curious: 0,
        groom: 0,
        walk: 1,
        dragging: 1,
        "sleep-enter": 2,
        sleep: 2,
        wake: 2,
        happy: 3,
        stretch: 3,
      };
      let lastFrame = -1;
      let lastRow = -1;
      let lastDirection = "";
      const draw = (now: number) => {
        if (cancelled || !imageRef.current) return;
        const selectedRow = actionRows ? Math.min(rows - 1, rowByAction[actionRef.current] ?? 0) : 0;
        const frameCount = actionRows ? columns : configuredFrameCount;
        const elapsed = Math.max(0, now - startedAtRef.current);
        const frame = Math.floor((elapsed / 1000) * fps) % frameCount;
        const column = actionRows ? frame : frame % columns;
        const row = actionRows ? selectedRow : Math.floor(frame / columns);
        const currentDirection = directionRef.current;
        if (frame !== lastFrame || row !== lastRow || currentDirection !== lastDirection) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.save();
          if (currentDirection === "left") {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
          }
          context.drawImage(image, column * frameWidth, row * frameHeight, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);
          context.restore();
          lastFrame = frame;
          lastRow = row;
          lastDirection = currentDirection;
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

  return <canvas ref={canvasRef} className="h-full w-full object-contain" aria-hidden="true" />;
}
