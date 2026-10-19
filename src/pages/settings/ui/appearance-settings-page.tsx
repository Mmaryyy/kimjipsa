"use client";

import { HomeSettings } from "./home-settings";
import { useSignOut } from "@/features/account";
import { AccountSettings } from "./account-settings";
import { HouseholdSettings } from "./household-settings";
import {
  TextButton,
  Text,
  ThemeModeSelector,
  GroupLabel,
  PageHeader,
} from "@/shared/ui";

function PlannedSettingsSection({
  title,
  odId,
}: {
  title: string;
  odId: string;
}) {
  return (
    <section data-od-id={odId} aria-label={title}>
      <GroupLabel>{title}</GroupLabel>
      <Text as="p" variant="caption" className="text-muted-foreground">
        준비 중이에요.
      </Text>
    </section>
  );
}

export function AppearanceSettingsPage() {
  const { onSignOut, pending, error } = useSignOut();

  return (
    <div className="kj-settings" data-od-id="settings-main">
      <PageHeader odId="settings" titleVariant="display" title="설정" />
      <AccountSettings />
      <PlannedSettingsSection title="알림" odId="set-notify" />
      <HomeSettings />
      <HouseholdSettings />
      <PlannedSettingsSection title="AI 집사" odId="set-ai" />
      <PlannedSettingsSection title="기억" odId="set-memory" />
      <section data-od-id="set-appearance">
        <GroupLabel>화면</GroupLabel>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span>모드</span>
          <ThemeModeSelector />
        </div>
      </section>
      <section
        data-od-id="set-account"
        aria-labelledby="account-settings-title"
      >
        <GroupLabel id="account-settings-title">계정</GroupLabel>
        <TextButton
          data-od-id="s-logout"
          onClick={onSignOut}
          disabled={pending}
          aria-busy={pending}
        >
          로그아웃
        </TextButton>
        <div
          className="flex min-h-11 items-center justify-between gap-3"
          data-od-id="s-withdraw"
        >
          <span className="text-muted-foreground">탈퇴하기</span>
          <Text variant="caption" className="text-muted-foreground">
            준비 중
          </Text>
        </div>
        {error && (
          <Text as="p" role="alert" className="text-error-text">
            {error}
          </Text>
        )}
      </section>
    </div>
  );
}
