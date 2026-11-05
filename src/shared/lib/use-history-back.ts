"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

let pendingNavigation: { path: string; time: number } | undefined;

export function markHistoryBack(path: string) {
  pendingNavigation = { path, time: Date.now() };
  try {
    sessionStorage.setItem(path, JSON.stringify(pendingNavigation));
  } catch {
    // 저장소가 막혀 있어도 같은 문서 안의 이동은 기억해요.
  }
}

export function useHistoryBack(path: string) {
  const router = useRouter();
  useEffect(() => {
    const pending = pendingNavigation;
    pendingNavigation = undefined;
    let marker = pending;
    try {
      marker = JSON.parse(sessionStorage.getItem(path) ?? "null");
      sessionStorage.removeItem(path);
    } catch {
      // 저장소를 읽을 수 없으면 메모리에 남은 이번 이동만 사용해요.
    }
    if (
      pending?.path === path &&
      marker?.path === path &&
      marker.time === pending.time &&
      window.location.pathname === path &&
      Date.now() - marker.time < 10_000
    ) {
      window.history.replaceState(
        { ...window.history.state, [path]: true },
        "",
      );
    }
  }, [path]);
  const onNavigate = useCallback(
    (event: { preventDefault: () => void }) => {
      if (window.history.state?.[path] === true) {
        event.preventDefault();
        router.back();
      }
    },
    [path, router],
  );
  return { onNavigate };
}
