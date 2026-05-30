import { useEffect } from "react";
import { useThemeStore } from "../stores/themeStore";

export function useTheme() {
  const hydrate = useThemeStore((s) => s._hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
}
