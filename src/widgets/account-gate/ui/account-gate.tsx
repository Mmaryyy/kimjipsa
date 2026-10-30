"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { prefetchHome } from "../model/prefetch-home";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import {
  useAccount,
  ProfileForm,
  useSignOut,
  withdrawAccount,
} from "@/features/account";
import { accountRoutes, currentTermsVersion } from "@/shared/config";
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Text,
  onboardingStyles,
} from "@/shared/ui";

function ConsentExitActions() {
  const signOut = useSignOut();
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);
  const withdrawal = useMutation({ mutationFn: withdrawAccount });
  const pending = signOut.pending || withdrawal.isPending;
  return (
    <div className="mt-4 grid gap-3">
      <Text as="p" variant="caption" className="text-muted-foreground">
        동의하지 않으면 서비스를 이용할 수 없어요. 로그아웃하거나 탈퇴할 수
        있어요.
      </Text>
      <Button variant="gray" disabled={pending} onClick={signOut.onSignOut}>
        로그아웃
      </Button>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          withdrawal.reset();
          setConfirmWithdrawal(true);
        }}
      >
        탈퇴하기
      </Button>
      {signOut.error && <p role="alert">{signOut.error}</p>}
      <ConfirmDialog
        open={confirmWithdrawal}
        onOpenChange={(open) => {
          if (!withdrawal.isPending) setConfirmWithdrawal(open);
        }}
        title="김집사에서 탈퇴할까요?"
        description="내 계정·개인 일정·알림과 안 쓴 초대 링크가 삭제돼요. 공유 항목은 가정에 남고, 마지막 구성원이면 가정 데이터도 삭제돼요. 삭제한 내용은 되돌릴 수 없어요."
        confirmLabel="탈퇴하기"
        pending={withdrawal.isPending}
        onConfirm={() => withdrawal.mutate()}
      >
        {withdrawal.error && (
          <p role="alert" className="text-error-text">
            {withdrawal.error.message}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

export function AccountGate({
  children,
  splash,
}: {
  children: ReactNode;
  splash: (leaving: boolean) => ReactNode;
}) {
  const account = useAccount();
  const router = useRouter();
  const pathname = usePathname();
  const client = useQueryClient();
  const [prefetched, setPrefetched] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [released, setReleased] = useState(false);
  let destination: string | null = null;
  if (account.data && !account.data.userId) destination = accountRoutes.login;
  else if (account.data && (!account.data.profile || !account.data.membership))
    destination = accountRoutes.onboarding;
  const needsConsent =
    !!account.data?.profile &&
    account.data.profile.termsVersion !== currentTermsVersion;
  const shouldPrefetch =
    !needsConsent &&
    pathname === accountRoutes.home &&
    !!account.data?.userId &&
    !!account.data.profile &&
    !!account.data.membership;
  useEffect(() => {
    if (!shouldPrefetch || released) return;
    let active = true;
    const finish = () => {
      if (active) setPrefetched(true);
    };
    const timer = window.setTimeout(finish, 3000);
    void prefetchHome(client).finally(() => {
      window.clearTimeout(timer);
      finish();
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [client, shouldPrefetch, released]);
  const settled = !account.isPending && (!shouldPrefetch || prefetched);
  const leaving = minimumElapsed && settled && !released;
  useEffect(() => {
    const timer = window.setTimeout(() => setMinimumElapsed(true), 900);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!leaving) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => setReleased(true),
      reducedMotion ? 0 : 200,
    );
    return () => window.clearTimeout(timer);
  }, [leaving]);
  useEffect(() => {
    if (released && destination && !account.isError)
      router.replace(destination);
  }, [released, destination, account.isError, router]);
  // 셸과 본문을 아예 마운트하지 않아 첫 HTML과 탭 순서에도 노출하지 않아요.
  if (!released || account.isPending || (destination && !account.isError))
    return splash(leaving || (released && destination !== null));
  if (
    account.error instanceof ApiError &&
    account.error.code === "identity_policy_violation"
  )
    return (
      <div className="grid gap-3">
        <ErrorState
          message={account.error.message}
          onRetry={() => {
            void account.refetch();
          }}
        />
        <Link
          href={`${accountRoutes.login}?error=identity`}
          className="text-primary"
        >
          다시 로그인하기
        </Link>
      </div>
    );
  if (account.isError)
    return (
      <ErrorState
        message={account.error.message}
        onRetry={() => {
          void account.refetch();
        }}
        retrying={account.isFetching}
      />
    );
  if (needsConsent && account.data?.profile)
    return (
      <main className="min-h-dvh px-4">
        <div
          className={onboardingStyles({ part: "page" })}
          data-od-id="ob-step-terms"
        >
          <section className={onboardingStyles({ part: "panel" })}>
            <Text as="h1" variant="title-lg">
              변경된 약관에 동의해 주세요
            </Text>
            <ProfileForm
              reconsent
              onboarding
              displayName={account.data.profile.displayName}
            />
            <ConsentExitActions />
          </section>
        </div>
      </main>
    );
  if (account.data?.userId && account.data.profile && account.data.membership)
    return children;
  return splash(false);
}
