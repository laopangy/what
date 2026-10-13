import { useEffect } from "react";
import { useChatStore } from "../stores/chatStore";

const IDLE_LIMIT_MS = 5 * 60_000;
const CHECK_INTERVAL_MS = 15_000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

const lockIfNeeded = () => {
  const { journalToken, messages, lockJournal } = useChatStore.getState();
  if (journalToken || messages.some((message) => message.sensitive && !message.masked)) lockJournal();
};

export function useJournalSession() {
  useEffect(() => {
    let lastActivity = Date.now();
    const markActive = () => {
      lastActivity = Date.now();
    };
    const checkIdle = () => {
      if (Date.now() - lastActivity >= IDLE_LIMIT_MS) lockIfNeeded();
    };

    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, markActive, { passive: true });
    window.addEventListener("pagehide", lockIfNeeded);
    const timer = window.setInterval(checkIdle, CHECK_INTERVAL_MS);
    return () => {
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, markActive);
      window.removeEventListener("pagehide", lockIfNeeded);
      window.clearInterval(timer);
      lockIfNeeded();
    };
  }, []);
}
