"use client";
import { useAccount } from "@/features/account";
import { useCallback } from "react";
import {
  isMockDataEnabled,
  mockEnabledCookie,
  mockPerspectiveCookie,
  mockStageCookie,
  accountRoutes,
} from "@/shared/config";
import { Banner, Button, Switch } from "@/shared/ui";
import { cn } from "@/shared/lib";

function navigateMock(
  perspective: "self" | "spouse",
  stage: string,
  path: string,
) {
  document.cookie = `${mockPerspectiveCookie}=${perspective}; Path=/; SameSite=Lax`;
  document.cookie = `${mockStageCookie}=${stage}; Path=/; SameSite=Lax`;
  window.location.assign(path);
}

function MockDataBanner() {
  const account = useAccount();
  const perspective = account.data?.profile?.displayName ?? "가입 전";
  const onSelf = useCallback(
    () => navigateMock("self", "ready", accountRoutes.home),
    [],
  );
  const onSpouse = useCallback(
    () => navigateMock("spouse", "ready", accountRoutes.home),
    [],
  );
  const onLogin = useCallback(
    () => navigateMock("self", "login", accountRoutes.login),
    [],
  );
  const onProfile = useCallback(
    () => navigateMock("self", "profile", accountRoutes.onboarding),
    [],
  );
  const onFamily = useCallback(
    () => navigateMock("self", "family", accountRoutes.onboarding),
    [],
  );
  return (
    <aside aria-label="개발용 테스트 데이터" className="mb-4">
      <Banner title={`테스트 데이터 · ${perspective} 시점`}>
        <p>
          저장·삭제는 서버 메모리에만 반영돼요. 새로고침과 시점 전환 후에도
          유지돼요.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={onSelf}>
            나 · 지수
          </Button>
          <Button size="sm" onClick={onSpouse}>
            배우자 · 민호
          </Button>
          <Button size="sm" onClick={onLogin}>
            로그인 화면
          </Button>
          <Button size="sm" onClick={onProfile}>
            가입 · 약관
          </Button>
          <Button size="sm" onClick={onFamily}>
            가입 · 가정
          </Button>
        </div>
      </Banner>
    </aside>
  );
}

export function MockDataToolbar() {
  const enabled = isMockDataEnabled();
  const onEnabledChange = useCallback((checked: boolean) => {
    const value = checked ? "1" : "";
    const expiry = checked ? "" : "; Max-Age=0";
    document.cookie = `${mockEnabledCookie}=${value}; Path=/; SameSite=Lax${expiry}`;
    window.location.reload();
  }, []);
  return (
    <>
      <aside
        aria-label="목업 모드 전환"
        className={cn(
          "fixed right-2 top-[calc(env(safe-area-inset-top)+var(--sp-2))] z-50",
          "flex items-center gap-2 bg-card p-2 text-foreground",
        )}
      >
        <label htmlFor="mock-data-enabled">목업 모드</label>
        <Switch
          id="mock-data-enabled"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </aside>
      {enabled && <MockDataBanner />}
    </>
  );
}
