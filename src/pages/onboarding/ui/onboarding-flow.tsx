"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  LoginButtons,
  LoginIntroduction,
  ProfileForm,
} from "@/features/account";
import { CreateFamilyForm, InviteShare, useFamily } from "@/features/family";
import { accountRoutes, invitePath } from "@/shared/config";
import {
  onboardingStyles,
  ErrorState,
  ListSkeleton,
  OnboardingProgress,
  Text,
  TextButton,
} from "@/shared/ui";

function InviteIntroduction() {
  const family = useFamily();
  return (
    <div>
      <Text as="h1" variant="title-lg" className="break-words">
        {family.data?.name
          ? `${family.data.name}에 함께할 사람을 초대해 주세요`
          : "함께 쓸 사람을 초대해 주세요"}
      </Text>
      <Text as="p" variant="body" className="mt-2 text-muted-foreground">
        링크를 받은 사람이 로그인하고 수락하면 바로 합류해요.
      </Text>
    </div>
  );
}

export function OnboardingFlow({ inviteToken }: { inviteToken?: string }) {
  const account = useAccount();
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [requestedStep, setRequestedStep] = useState<number | null>(null);
  const destination = inviteToken
    ? invitePath(inviteToken)
    : accountRoutes.home;
  useEffect(() => {
    if (
      !inviting &&
      (account.data?.membership || (inviteToken && account.data?.profile))
    )
      router.replace(destination);
  }, [account.data, destination, inviteToken, inviting, router]);
  const onProfileSaved = useCallback(() => {
    setRequestedStep(null);
    if (inviteToken) router.replace(invitePath(inviteToken));
  }, [inviteToken, router]);
  const onCreated = useCallback(() => {
    setInviting(true);
    setRequestedStep(null);
  }, []);
  if (account.isError)
    return (
      <ErrorState
        message={account.error.message}
        onRetry={() => {
          void account.refetch();
        }}
      />
    );
  if (account.isPending)
    return <ListSkeleton label="우리 집 정보를 확인하고 있어요" />;
  if (account.data.membership && !inviting)
    return <ListSkeleton label="오늘 화면으로 이동하고 있어요" />;
  const actualStep = inviting
    ? 4
    : !account.data.userId
      ? 1
      : !account.data.profile
        ? 2
        : 3;
  const step = Math.min(requestedStep ?? actualStep, actualStep);
  return (
    <div
      className={onboardingStyles({ part: "page" })}
      data-od-id="onboarding-main"
    >
      <OnboardingProgress
        step={step}
        onBack={
          step === 1 && inviteToken !== undefined
            ? undefined
            : () => {
                if (step === 1) router.replace(accountRoutes.login);
                else setRequestedStep(step - 1);
              }
        }
      />
      {step === 1 && (
        <section
          data-od-id="ob-step-login"
          className={onboardingStyles({ part: "panel" })}
        >
          <LoginIntroduction />
          {account.data.userId ? (
            <TextButton onClick={() => setRequestedStep(null)}>계속</TextButton>
          ) : (
            <LoginButtons inviteToken={inviteToken} />
          )}
        </section>
      )}
      {step === 2 && (
        <section
          data-od-id="ob-step-terms"
          className={onboardingStyles({ part: "panel" })}
        >
          <Text as="h1" variant="title-lg">
            약관에 동의해 주세요
          </Text>
          <ProfileForm
            onboarding
            onSaved={onProfileSaved}
            displayName={account.data.profile?.displayName}
          />
        </section>
      )}
      {step === 3 && (
        <section
          data-od-id="ob-step-home"
          className={onboardingStyles({ part: "panel" })}
        >
          <div>
            <Text as="h1" variant="title-lg">
              우리 집 이름을 정해 주세요
            </Text>
            <Text as="p" variant="body" className="mt-2 text-muted-foreground">
              이 이름은 일정의 첫 카테고리로도 쓰여요.
            </Text>
          </div>
          {inviting ? (
            <TextButton onClick={() => setRequestedStep(null)}>
              초대 링크로 계속
            </TextButton>
          ) : (
            <CreateFamilyForm onCreated={onCreated} />
          )}
        </section>
      )}
      {inviting && (
        <div
          hidden={step !== 4}
          className={step === 4 ? "flex flex-1 flex-col" : undefined}
        >
          <section
            data-od-id="ob-step-invite"
            className="flex flex-1 flex-col gap-8 pt-10"
          >
            <InviteIntroduction />
            <InviteShare
              onboarding
              onLater={() => router.replace(accountRoutes.home)}
            />
          </section>
        </div>
      )}
    </div>
  );
}
