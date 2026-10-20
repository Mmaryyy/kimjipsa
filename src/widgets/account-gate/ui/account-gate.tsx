"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchHome } from "../model/prefetch-home";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { useAccount } from "@/features/account";
import { accountRoutes } from "@/shared/config";
import { ErrorState } from "@/shared/ui";

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
  const shouldPrefetch =
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
  if (account.data?.userId && account.data.profile && account.data.membership)
    return children;
  return splash(false);
}
