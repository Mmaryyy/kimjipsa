"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginButtons, useAccount } from "@/features/account";
import { accountRoutes, onboardingPath } from "@/shared/config";
import { ErrorState, ListSkeleton } from "@/shared/ui";

export function LoginFlow({ inviteToken }: { inviteToken?: string }) {
  const account = useAccount();
  const router = useRouter();
  const destination = account.data?.userId
    ? account.data.profile && account.data.membership
      ? accountRoutes.home
      : onboardingPath(inviteToken)
    : null;

  useEffect(() => {
    if (!account.isError && destination) router.replace(destination);
  }, [account.isError, destination, router]);

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
  return <LoginButtons inviteToken={inviteToken} />;
}
