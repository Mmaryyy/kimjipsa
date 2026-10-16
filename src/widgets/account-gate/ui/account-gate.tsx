"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "@/shared/api";
import { useAccount } from "@/features/account";
import { accountRoutes } from "@/shared/config";
import { ErrorState, ListSkeleton } from "@/shared/ui";
export function AccountGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const router = useRouter();
  let destination: string | null = null;
  if (account.data && !account.data.userId) destination = accountRoutes.login;
  else if (account.data && (!account.data.profile || !account.data.membership))
    destination = accountRoutes.onboarding;
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
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
  if (account.isPending || destination)
    return <ListSkeleton label="로그인 상태를 확인하고 있어요" />;
  return children;
}
