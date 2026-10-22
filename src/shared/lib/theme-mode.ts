"use client";

import { useSyncExternalStore } from "react";
import { themeModeStorageKey, type ThemeMode } from "@/shared/config";

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;
}

export function setThemeMode(mode: ThemeMode) {
  if (mode === getThemeModeSnapshot()) return;
  applyThemeMode(mode);
  try {
    localStorage.setItem(themeModeStorageKey, mode);
  } catch {
    /* 저장이 막혀도 현재 화면에는 적용해요. */
  }
  window.dispatchEvent(new Event("kj:theme-mode"));
}

function getThemeModeSnapshot(): ThemeMode {
  const mode = document.documentElement.dataset.themeMode;
  return mode === "light" || mode === "dark" ? mode : "system";
}

function subscribeToThemeMode(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== themeModeStorageKey && event.key !== null) return;
    const mode = event.newValue;
    applyThemeMode(mode === "light" || mode === "dark" ? mode : "system");
    listener();
  };
  window.addEventListener("kj:theme-mode", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("kj:theme-mode", listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThemeMode() {
  const mode = useSyncExternalStore(
    subscribeToThemeMode,
    getThemeModeSnapshot,
    () => "system" as ThemeMode,
  );
  return { mode, setMode: setThemeMode };
}
