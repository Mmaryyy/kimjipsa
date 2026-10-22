"use client";

import {
  GroupLabel,
  PageHeader,
  Text,
  TextButton,
  ThemeModeSelector,
} from "@/shared/ui";

import AccountSettings from "../account-settings";
import HomeSettings from "../home-settings";
import HouseholdSettings from "../household-settings";
import Link from "next/link";
import NotificationSettings from "../notification-settings";
import PlannedSettingsSection from "./PlannedSection";
import SettingsRow from "../settings-row";
import { cn } from "@/shared/lib";
import { useSignOut } from "@/features/account";
import { viewportPath } from "@/shared/config";

const AppearanceSettingsPage = () => {
  const { onSignOut, pending, error } = useSignOut();

  return (
    <div
      className={cn([
        "[&>section]:mt-10 [&>section>[data-slot=group-label]]:pt-0",
        "[&_[data-slot=segmented-control]]:w-42 [&_[data-slot=field-row]>label]:w-auto",
        "[&_[data-slot=field-row]>label]:flex-1 [&_[data-slot=input]]:w-35",
        "[&_[data-slot=input]]:text-right",
      ])}
      data-od-id="settings-main"
    >
      <PageHeader odId="settings" title="설정" />
      <AccountSettings />
      <NotificationSettings />
      <HomeSettings />
      <section data-od-id="set-appearance">
        <GroupLabel>화면</GroupLabel>
        <SettingsRow label="모드" action={<ThemeModeSelector />} />
      </section>
      <AccountSettings section="members" />
      <HouseholdSettings />
      <PlannedSettingsSection title="AI 집사" odId="set-ai" />
      <PlannedSettingsSection title="기억" odId="set-memory" />
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
        <SettingsRow
          odId="s-withdraw"
          label={<span className="text-muted-foreground">탈퇴하기</span>}
          action={
            <Text variant="caption" className="text-muted-foreground">
              준비 중
            </Text>
          }
        />
        {error && (
          <Text as="p" role="alert" className="text-error-text">
            {error}
          </Text>
        )}
      </section>
      {process.env.NODE_ENV === "development" && (
        <div className="mt-10 pb-4" data-od-id="set-viewport">
          <Link
            href={viewportPath}
            className="kj-hit text-caption text-muted-foreground"
          >
            개발용 · 화면 정보
          </Link>
        </div>
      )}
    </div>
  );
};

export default AppearanceSettingsPage;
