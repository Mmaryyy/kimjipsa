"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, LoginButtons, ProfileForm } from "@/features/account";
import { CreateFamilyForm } from "@/features/family";
import { accountRoutes, invitePath } from "@/shared/config";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  Text,
} from "@/shared/ui";
export function OnboardingFlow({ inviteToken }: { inviteToken?: string }) {
  const account = useAccount();
  const router = useRouter();
  const destination = account.data?.membership
    ? accountRoutes.home
    : inviteToken
      ? invitePath(inviteToken)
      : accountRoutes.home;
  useEffect(() => {
    if (account.data?.membership || (inviteToken && account.data?.profile))
      router.replace(destination);
  }, [account.data, destination, inviteToken, router]);
  const onProfileSaved = useCallback(() => {
    if (inviteToken) router.replace(invitePath(inviteToken));
  }, [inviteToken, router]);
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
  if (
    account.isPending ||
    account.data.membership ||
    (inviteToken && account.data.profile)
  )
    return <ListSkeleton label="우리 집 정보를 확인하고 있어요" />;
  if (!account.data.userId)
    return (
      <div className="grid gap-5">
        <PageHeader title="김집사 시작하기" />
        <LoginButtons inviteToken={inviteToken} />
      </div>
    );
  if (!account.data.profile)
    return (
      <div className="grid gap-5">
        <PageHeader title="반가워요" />
        <Text as="p">약관에 동의하고 함께 쓸 이름을 알려 주세요.</Text>
        <ProfileForm onSaved={onProfileSaved} />
      </div>
    );
  return (
    <div className="grid gap-5">
      <PageHeader title="우리 집 만들기" />
      <EmptyState message="아직 소속된 가정이 없어요. 초대받았다면 받은 링크를 열어 주세요." />
      <CreateFamilyForm />
    </div>
  );
}
