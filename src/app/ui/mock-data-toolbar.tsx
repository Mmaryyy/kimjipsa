"use client";
import { useAccount } from "@/features/account";
import { useCallback, type CSSProperties } from "react";
import { Dialog } from "radix-ui";
import { FlaskConical } from "lucide-react";
import {
  isMockDataEnabled,
  mockEnabledCookie,
  mockPerspectiveCookie,
  mockStageCookie,
  mockConsentResetCookie,
  accountRoutes,
} from "@/shared/config";
import { Banner, Button, Switch } from "@/shared/ui";
import { cn } from "@/shared/lib";

function navigateMock(
  perspective: "self" | "spouse",
  stage: string,
  path: string,
) {
  if (stage === "reconsent")
    document.cookie = `${mockConsentResetCookie}=${crypto.randomUUID()}; Path=/; SameSite=Lax`;
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
  const onReconsent = useCallback(
    () => navigateMock("self", "reconsent", accountRoutes.home),
    [],
  );
  const onFamily = useCallback(
    () => navigateMock("self", "family", accountRoutes.onboarding),
    [],
  );
  return (
    <div>
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
          <Button size="sm" onClick={onReconsent}>
            약관 재동의
          </Button>
          <Button size="sm" onClick={onFamily}>
            가입 · 가정
          </Button>
        </div>
      </Banner>
    </div>
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
    <Dialog.Root modal={false}>
      <div
        style={
          {
            "--mock-toolbar-bottom":
              "calc(var(--bottom-navigation-offset) + env(safe-area-inset-bottom) + var(--sp-4))",
          } as CSSProperties
        }
        className="fixed right-2 bottom-[var(--mock-toolbar-bottom)] z-50 lg:bottom-8"
      >
        <Dialog.Trigger asChild>
          <Button
            variant="gray"
            size="sm"
            aria-label="개발용 테스트 데이터 열기"
          >
            <FlaskConical size={18} aria-hidden="true" />
          </Button>
        </Dialog.Trigger>
        <Dialog.Content
          style={{
            maxHeight:
              "calc(100dvh - var(--bottom-navigation-offset) - " +
              "env(safe-area-inset-bottom) - env(safe-area-inset-top) - var(--hit) - var(--sp-5))",
          }}
          className={cn(
            "absolute bottom-full right-0 mb-2 grid gap-3 overflow-y-auto",
            "w-[min(360px,calc(100vw-16px))]",
            "rounded-[var(--r-control)] bg-card p-4 text-foreground",
            "shadow-[var(--shadow-navigation)]",
          )}
        >
          <Dialog.Title className="text-headline">
            개발용 테스트 데이터
          </Dialog.Title>
          <Dialog.Description className="text-caption text-muted-foreground">
            목업 모드와 시점을 바꿔 화면을 확인해요.
          </Dialog.Description>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="mock-data-enabled">목업 모드</label>
            <Switch
              id="mock-data-enabled"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>
          {enabled && <MockDataBanner />}
        </Dialog.Content>
      </div>
    </Dialog.Root>
  );
}
