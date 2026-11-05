"use client";

import { useSyncExternalStore } from "react";

let visible = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setCartActionsVisible(next: boolean) {
  if (visible === next) return;
  visible = next;
  listeners.forEach((listener) => listener());
}

export function useCartActionsVisible() {
  return useSyncExternalStore(
    subscribe,
    () => visible,
    () => false,
  );
}
