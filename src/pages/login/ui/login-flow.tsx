"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LoginButtons,
  LoginIntroduction,
  useAccount,
} from "@/features/account";
import { accountRoutes, onboardingPath } from "@/shared/config";
import {
  Banner,
  BrandLogo,
  Button,
  ErrorState,
  ListSkeleton,
  OnboardingProgress,
} from "@/shared/ui";

export function LoginFlow({
  inviteToken,
  error,
  loginRequested = false,
}: {
  inviteToken?: string;
  error?: string;
  loginRequested?: boolean;
}) {
  const account = useAccount();
  const router = useRouter();
  const showLogin =
    loginRequested || inviteToken !== undefined || error !== undefined;
  const onStart = useCallback(() => {
    router.push(`${accountRoutes.login}?step=login`);
  }, [router]);
  const onBack = useCallback(() => {
    router.back();
  }, [router]);
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
  return (
    <div className="kj-onboarding" data-od-id="onboarding-main">
      {showLogin ? (
        <>
          <OnboardingProgress
            step={1}
            onBack={
              inviteToken === undefined && error === undefined
                ? onBack
                : undefined
            }
          />
          <section className="kj-onboarding-panel" data-od-id="ob-step-login">
            <LoginIntroduction />
            {error !== undefined && (
              <Banner variant="error" title="로그인을 마치지 못했어요">
                {error === "identity"
                  ? "다른 로그인 수단으로 시도하거나 서비스 운영자에게 문의해 주세요"
                  : "다시 로그인해 주세요. 계속되면 연결 설정을 확인해 주세요."}
              </Banner>
            )}
            <LoginButtons inviteToken={inviteToken} />
          </section>
        </>
      ) : (
        <>
          <div
            className="flex flex-1 items-center justify-center"
            data-od-id="ob-start-logo"
          >
            <BrandLogo />
          </div>
          <Button
            size="block"
            autoFocus
            onClick={onStart}
            data-od-id="ob-start"
          >
            시작하기
          </Button>
        </>
      )}
    </div>
  );
}
