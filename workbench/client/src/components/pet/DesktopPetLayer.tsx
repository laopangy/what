import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Coffee, EyeOff, Hand, MessageCircle, Moon, Pause, Play, Settings, Sparkles, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { onMusicEvent } from "../../api/musicSocket";
import { subscribeToPetState, type PetWorkspaceEvent } from "../../api/petApi";
import { useChatStore } from "../../stores/chatStore";
import { usePetStore } from "../../stores/petStore";
import type { PetAction, PetInteractionType, PetPosition, PetSettings } from "../../types/pet";
import { choosePetBehavior, nextBehaviorDelay } from "./behaviorEngine";
import { chooseDialogue } from "./dialogue";
import { actionDuration, canEnterPetAction } from "./petMachine";
import CustomPetRenderer from "./CustomPetRenderer";
import PetDialoguePanel from "./PetDialoguePanel";
import PetSpriteCanvas from "./PetSpriteCanvas";

const PET_SIZE = 210;

export default function DesktopPetLayer() {
  const navigate = useNavigate();
  const state = usePetStore((store) => store.state);
  const load = usePetStore((store) => store.load);
  const applyState = usePetStore((store) => store.applyState);
  const saveSettings = usePetStore((store) => store.saveSettings);
  const savePosition = usePetStore((store) => store.savePosition);
  const interact = usePetStore((store) => store.interact);
  const layerRef = useRef<HTMLDivElement>(null);
  const petRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<PetPosition>({ x: 0.84, y: 0.78 });
  const storedPositionRef = useRef<PetPosition>({ x: -1, y: -1 });
  const actionRef = useRef<PetAction>("idle");
  const actionTimerRef = useRef<number | null>(null);
  const movementFrameRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const draggedRef = useRef(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });
  const hoverCooldownRef = useRef(0);
  const settingsRef = useRef<PetSettings | undefined>(undefined);
  const musicStateRef = useRef({ initialized: false, playing: false, trackKey: "" });
  const [action, setAction] = useState<PetAction>("idle");
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [bubble, setBubble] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [dialogueOpen, setDialogueOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const settings = state?.settings;
  settingsRef.current = settings;
  const customPet = state?.customPets.find((pet) => pet.id === settings?.activePetId);
  const scale = settings?.scale ?? 1;

  const applyPosition = useCallback((position = positionRef.current) => {
    const layer = layerRef.current;
    const pet = petRef.current;
    if (!layer || !pet) return;
    const width = Math.max(1, layer.clientWidth - PET_SIZE * scale);
    const height = Math.max(1, layer.clientHeight - PET_SIZE * scale);
    const x = Math.max(0, Math.min(1, position.x));
    const y = Math.max(0, Math.min(1, position.y));
    pet.style.transform = `translate3d(${x * width}px, ${y * height}px, 0) scale(${scale})`;
  }, [scale]);

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current);
    actionTimerRef.current = null;
  }, []);

  const setPetAction = useCallback((next: PetAction, userInitiated = false, finalAction: PetAction = "idle") => {
    if (!canEnterPetAction(actionRef.current, next, userInitiated)) return;
    clearActionTimer();
    actionRef.current = next;
    setAction(next);
    const duration = actionDuration(next);
    if (duration > 0 && next !== "walk") {
      actionTimerRef.current = window.setTimeout(() => {
        actionRef.current = finalAction;
        setAction(finalAction);
      }, duration);
    }
  }, [clearActionTimer]);

  const showBubble = useCallback((message: string) => {
    if (!settingsRef.current?.dialogueEnabled) return;
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    setBubble(message);
    bubbleTimerRef.current = window.setTimeout(() => setBubble(null), 3_200);
  }, []);

  const playInteraction = useCallback((next: PetAction, type: PetInteractionType) => {
    setPetAction(next, true);
    showBubble(chooseDialogue(next, settings?.activePetId));
    void interact(type).catch(() => undefined);
  }, [interact, setPetAction, settings?.activePetId, showBubble]);

  const moveTo = useCallback((target: PetPosition, duration = 2_000) => {
    if (reducedMotion || draggingRef.current) return;
    if (movementFrameRef.current !== null) cancelAnimationFrame(movementFrameRef.current);
    const start = { ...positionRef.current };
    setDirection(target.x < start.x ? "left" : "right");
    actionRef.current = "walk";
    setAction("walk");
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      positionRef.current = {
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
      };
      applyPosition();
      if (progress < 1) {
        movementFrameRef.current = requestAnimationFrame(tick);
      } else {
        movementFrameRef.current = null;
        actionRef.current = "idle";
        setAction("idle");
      }
    };
    movementFrameRef.current = requestAnimationFrame(tick);
  }, [applyPosition, reducedMotion]);

  const reactToTimerEvent = useCallback((event: PetWorkspaceEvent) => {
    const current = settingsRef.current;
    if (!current?.enabled || !current.eventLinkEnabled) return;
    const label = event.label.length > 20 ? `${event.label.slice(0, 20)}…` : event.label;
    if (event.status === "running") {
      setPetAction("curious", false);
      showBubble(`任务「${label}」开始执行。`);
    } else if (event.status === "success") {
      setPetAction("happy", false);
      showBubble(`任务「${label}」完成啦。`);
    } else {
      setPetAction("curious", false);
      showBubble(`任务「${label}」执行失败，请查看记录。`);
    }
  }, [setPetAction, showBubble]);

  useEffect(() => {
    void load();
    return subscribeToPetState(applyState, reactToTimerEvent);
  }, [applyState, load, reactToTimerEvent]);

  useEffect(() => onMusicEvent("playback:state", (data) => {
    if (!data || typeof data !== "object") return;
    const snapshot = data as { playing?: unknown; song?: { id?: unknown; name?: unknown; artist?: unknown } };
    if (typeof snapshot.playing !== "boolean") return;
    const previous = musicStateRef.current;
    const songName = typeof snapshot.song?.name === "string" ? snapshot.song.name : "";
    const songArtist = typeof snapshot.song?.artist === "string" ? snapshot.song.artist : "";
    const songId = typeof snapshot.song?.id === "string" ? snapshot.song.id : "";
    const trackKey = songName ? songId || `${songName}\u0000${songArtist}` : previous.trackKey;
    musicStateRef.current = { initialized: true, playing: snapshot.playing, trackKey };
    if (!previous.initialized) return;
    const current = settingsRef.current;
    if (!current?.enabled || !current.eventLinkEnabled) return;
    if (snapshot.playing && trackKey && previous.trackKey && trackKey !== previous.trackKey) {
      setPetAction("happy", false);
      showBubble(songName ? `换到《${songName.slice(0, 24)}》啦。` : "换一首继续听吧。");
    } else if (!previous.playing && snapshot.playing) {
      setPetAction("happy", false);
      showBubble(songName ? `一起听《${songName.slice(0, 24)}》吧。` : "音乐开始啦。");
    } else if (previous.playing && !snapshot.playing) {
      setPetAction("curious", false);
      showBubble("音乐暂停了，休息一下吧。");
    }
  }), [setPetAction, showBubble]);

  useEffect(() => useChatStore.subscribe((current, previous) => {
    const event = current.lastRequestEvent;
    if (!event || event.sequence === previous.lastRequestEvent?.sequence) return;
    const petSettings = settingsRef.current;
    if (!petSettings?.enabled || !petSettings.eventLinkEnabled) return;
    if (event.status === "started") {
      setPetAction("curious", false);
      showBubble("我陪你一起想一想。");
    } else if (event.status === "succeeded") {
      setPetAction("happy", false);
      showBubble("回答准备好了，快看看吧。");
    } else {
      setPetAction("curious", false);
      showBubble("这次没有连上，要不要再试试？");
    }
  }), [setPetAction, showBubble]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setAssetError(null);
  }, [settings?.activePetId]);

  useEffect(() => {
    if (!state) return;
    const changed = state.position.x !== storedPositionRef.current.x || state.position.y !== storedPositionRef.current.y;
    if (changed && !draggingRef.current) {
      storedPositionRef.current = state.position;
      positionRef.current = state.position;
      applyPosition(state.position);
    } else {
      applyPosition();
    }
  }, [applyPosition, state]);

  useEffect(() => {
    const resize = () => applyPosition();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [applyPosition]);

  useEffect(() => {
    if (!settings?.enabled || !settings.autonomous || paused || reducedMotion) return;
    let cancelled = false;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled || document.hidden || draggingRef.current) {
          schedule();
          return;
        }
        const next = choosePetBehavior(settings.activityLevel, actionRef.current, settings.activePetId);
        if (next === "walk") {
          const target = {
            x: Math.max(0.04, Math.min(0.96, positionRef.current.x + (Math.random() - 0.5) * 0.42)),
            y: Math.max(0.62, Math.min(0.94, positionRef.current.y + (Math.random() - 0.5) * 0.12)),
          };
          moveTo(target, 1_600 + Math.random() * 1_200);
        } else if (next === "sleep-enter") {
          setPetAction("sleep-enter", false, "sleep");
          window.setTimeout(() => {
            if (!cancelled && actionRef.current === "sleep") setPetAction("wake", true, "idle");
          }, 8_000 + Math.random() * 5_000);
        } else if (next !== "idle") {
          setPetAction(next, false);
          if (Math.random() < 0.28) showBubble(chooseDialogue(next, settings.activePetId));
        }
        schedule();
      }, nextBehaviorDelay(settings.activityLevel));
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [moveTo, paused, reducedMotion, setPetAction, settings?.activePetId, settings?.activityLevel, settings?.autonomous, settings?.enabled, showBubble]);

  useEffect(() => () => {
    clearActionTimer();
    if (movementFrameRef.current !== null) cancelAnimationFrame(movementFrameRef.current);
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
  }, [clearActionTimer]);

  const handleClick = () => {
    if (draggedRef.current) return;
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => playInteraction("happy", "click"), 230);
  };

  const handleDoubleClick = () => {
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
    playInteraction("stretch", "double-click");
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    draggedRef.current = false;
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: positionRef.current.x,
      y: positionRef.current.y,
    };
    setPetAction("dragging", true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || !layerRef.current) return;
    const dx = event.clientX - dragStartRef.current.pointerX;
    const dy = event.clientY - dragStartRef.current.pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 5) draggedRef.current = true;
    const width = Math.max(1, layerRef.current.clientWidth - PET_SIZE * scale);
    const height = Math.max(1, layerRef.current.clientHeight - PET_SIZE * scale);
    positionRef.current = {
      x: Math.max(0, Math.min(1, dragStartRef.current.x + dx / width)),
      y: Math.max(0, Math.min(1, dragStartRef.current.y + dy / height)),
    };
    applyPosition();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (draggedRef.current) {
      setPetAction("happy", true);
      void savePosition(positionRef.current).catch(() => showBubble("位置暂时没有保存成功。"));
    } else {
      setPetAction("idle", true);
    }
  };

  const runMenuAction = (type: PetInteractionType, next: PetAction) => {
    setMenu(null);
    playInteraction(next, type);
  };

  const toggleRest = () => {
    setMenu(null);
    if (actionRef.current === "sleep") {
      playInteraction("wake", "wake");
      return;
    }
    setPetAction("sleep-enter", true, "sleep");
    showBubble(chooseDialogue("sleep", settings?.activePetId));
    void interact("sleep").catch(() => undefined);
  };

  if (!settings?.enabled) return null;

  return (
    <div ref={layerRef} className="pointer-events-none fixed bottom-0 left-[78px] right-0 top-14 z-20 overflow-hidden" aria-label="桌面灵宠区域">
      <div
        ref={petRef}
        className="absolute left-0 top-0 h-[210px] w-[210px] origin-top-left will-change-transform"
        style={{ opacity: settings.opacity }}
      >
        {bubble && (
          <div className="pet-bubble pointer-events-none absolute bottom-[86%] left-1/2 z-20 w-max max-w-48 -translate-x-1/2 rounded-xl border border-white/16 bg-[#26343d]/94 px-3 py-2 text-[11px] leading-5 text-white shadow-[0_14px_36px_rgb(20_33_41_/.3)] backdrop-blur-lg">
            {bubble}
          </div>
        )}
        {assetError ? (
          <div className="absolute inset-5 grid place-items-center rounded-2xl border border-red-200/20 bg-[#2c3942]/95 px-4 text-center text-[10px] leading-5 text-red-100">
            {assetError}
          </div>
        ) : customPet ? (
          <CustomPetRenderer pet={customPet} action={action} direction={direction} onError={setAssetError} />
        ) : (
          <PetSpriteCanvas petId={settings.activePetId} action={action} direction={direction} onError={setAssetError} />
        )}
        <button
          type="button"
          aria-label={`与${settings.customName}互动`}
          title={`与${settings.customName}互动`}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerEnter={() => {
            const now = Date.now();
            if (now > hoverCooldownRef.current && actionRef.current === "idle") {
              hoverCooldownRef.current = now + 5_000;
              setPetAction("curious", false);
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            const layer = layerRef.current?.getBoundingClientRect();
            if (layer) setMenu({ x: event.clientX - layer.left, y: event.clientY - layer.top });
          }}
          className="pointer-events-auto absolute bottom-[5%] left-[18%] h-[78%] w-[64%] cursor-grab touch-none rounded-[42%] bg-transparent outline-none active:cursor-grabbing"
        />
      </div>

      {dialogueOpen && (
        <PetDialoguePanel
          key={settings.activePetId}
          petName={settings.customName}
          currentAction={action}
          onClose={() => setDialogueOpen(false)}
          onReply={(reply) => {
            setPetAction("happy", true);
            showBubble(reply);
          }}
        />
      )}

      {menu && (
        <div
          className="pointer-events-auto absolute z-30 w-44 overflow-hidden rounded-xl border border-white/12 bg-[#2a3740]/96 p-1.5 text-[11px] text-white shadow-[0_18px_44px_rgb(20_32_40_/.42)] backdrop-blur-xl"
          style={{ left: Math.min(menu.x, Math.max(8, window.innerWidth - 78 - 190)), top: Math.min(menu.y, Math.max(8, window.innerHeight - 56 - 260)) }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <MenuButton icon={Hand} label="抚摸" onClick={() => runMenuAction("pet", "happy")} />
          <MenuButton icon={Coffee} label="喂食" onClick={() => runMenuAction("feed", "happy")} />
          <MenuButton icon={Sparkles} label="玩一会儿" onClick={() => runMenuAction("play", "stretch")} />
          <MenuButton icon={MessageCircle} label="和我说说话" onClick={() => { setMenu(null); setDialogueOpen(true); }} />
          <MenuButton icon={action === "sleep" ? Sun : Moon} label={action === "sleep" ? "唤醒灵宠" : "进入休息"} onClick={toggleRest} />
          <div className="my-1 h-px bg-white/[0.08]" />
          <MenuButton icon={paused ? Play : Pause} label={paused ? "恢复自主活动" : "暂停自主活动"} onClick={() => {
            setPaused((value) => {
              const next = !value;
              if (next) {
                if (movementFrameRef.current !== null) cancelAnimationFrame(movementFrameRef.current);
                movementFrameRef.current = null;
                actionRef.current = "idle";
                setAction("idle");
              }
              return next;
            });
            setMenu(null);
          }} />
          <MenuButton icon={Settings} label="打开灵宠中心" onClick={() => { setMenu(null); navigate("/tools?page=pet"); }} />
          <MenuButton icon={EyeOff} label="隐藏灵宠" onClick={() => {
            setMenu(null);
            void saveSettings({ enabled: false }).catch(() => showBubble("暂时无法隐藏。"));
          }} />
        </div>
      )}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Hand;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-white/78 transition-colors hover:bg-white/[0.08] hover:text-white">
      <Icon className="h-3.5 w-3.5 text-accent-dim" strokeWidth={1.7} />
      {label}
    </button>
  );
}
