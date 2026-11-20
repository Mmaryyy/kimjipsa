import { useId, useLayoutEffect, useSyncExternalStore } from "react";

const baseLayer = 80;
const openLayers: string[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

const firstLayer = () => baseLayer;

export function useSheetLayer(open: boolean) {
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    openLayers.push(id);
    notify();
    return () => {
      openLayers.splice(openLayers.indexOf(id), 1);
      notify();
    };
  }, [id, open]);
  return useSyncExternalStore(
    subscribe,
    () => baseLayer + Math.max(0, openLayers.indexOf(id)) * 2,
    firstLayer,
  );
}

export function useTopSheetLayer() {
  return useSyncExternalStore(
    subscribe,
    () => baseLayer + openLayers.length * 2 - 1,
    firstLayer,
  );
}
