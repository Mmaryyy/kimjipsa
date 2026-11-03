"use client";
import Link from "next/link";
import { useAccount, LoginButtons } from "@/features/account";
import { useInvite, useAcceptInvite } from "@/features/family";
import {
  accountRoutes,
  currentTermsVersion,
  onboardingPath,
} from "@/shared/config";
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
  PageLayout,
  Text,
} from "@/shared/ui";
const unavailableMessages = {
  used: "이미 사용된 초대 링크예요. 가정 관리자에게 새 링크를 요청해 주세요.",
  expired: "만료된 초대 링크예요. 가정 관리자에게 새 링크를 요청해 주세요.",
  not_found: "초대 링크를 찾을 수 없어요. 받은 링크를 다시 확인해 주세요.",
} as const;
export function InvitePage({ token }: { token: string }) {
  const invite = useInvite(token);
  const account = useAccount();
  const { onAccept, pending, error } = useAcceptInvite(token);
  if (pending)
    return (
      <PageLayout width="narrow">
        <ListSkeleton label="합류하고 있어요" />
      </PageLayout>
    );
  if (invite.isError || account.isError)
    return (
      <PageLayout width="narrow">
        <ErrorState
          message={(invite.error ?? account.error)?.message}
          onRetry={() => {
            void invite.refetch();
            void account.refetch();
          }}
          retrying={invite.isFetching || account.isFetching}
        />
      </PageLayout>
    );
  if (invite.isPending || account.isPending)
    return (
      <PageLayout width="narrow">
        <ListSkeleton label="초대를 확인하고 있어요" />
      </PageLayout>
    );
  if (invite.data.status !== "valid")
    return (
      <PageLayout width="narrow" header={<PageHeader title="초대 링크 안내" />}>
        <EmptyState
          message={unavailableMessages[invite.data.status]}
          action={
            <Link href={accountRoutes.home} className="text-primary">
              우리 집으로 가기
            </Link>
          }
        />
      </PageLayout>
    );
  const familyName = invite.data.familyName;
  let action;
  if (account.data.membership)
    action = (
      <EmptyState
        message="이미 가정에 속해 있어 합류할 수 없어요."
        action={
          <Link href={accountRoutes.family} className="text-primary">
            내 가정 보기
          </Link>
        }
      />
    );
  else if (!account.data.userId) action = <LoginButtons inviteToken={token} />;
  else if (
    !account.data.profile ||
    account.data.profile.termsVersion !== currentTermsVersion
  )
    action = (
      <Link href={onboardingPath(token)} className="text-primary">
        약관에 동의하고 표시 이름 정하기
      </Link>
    );
  else
    action = (
      <Button onClick={onAccept} disabled={pending}>
        {pending ? "합류하고 있어요" : "초대 수락하고 합류하기"}
      </Button>
    );
  return (
    <PageLayout
      width="narrow"
      className="grid gap-5"
      header={<PageHeader title="우리 집 초대" />}
    >
      <Text as="h2" variant="title-sm">
        {familyName}
      </Text>
      <Text as="p">
        함께 관리할 우리 집에 초대받았어요. 합류하면 동등한 관리자가 돼요.
      </Text>
      {error && (
        <Banner role="alert" variant="error" title="합류하지 못했어요">
          {error.message}
        </Banner>
      )}
      {action}
    </PageLayout>
  );
}
