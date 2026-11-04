"use client";

import {
  GroupLabel,
  PageHeader,
  PageLayout,
  Text,
  TextButton,
  ThemeModeSelector,
} from "@/shared/ui";

import AccountSettings from "../account-settings";
import AiSettings from "../ai-settings";
import HomeSettings from "../home-settings";
import HouseholdSettings from "../household-settings";
import Link from "next/link";
import NotificationSettings from "../notification-settings";
import SettingsRow from "../settings-row";
import WithdrawAccount from "../withdraw-account";
import { cn } from "@/shared/lib";
import { useSignOut } from "@/features/account";
import { viewportPath } from "@/shared/config";

const AppearanceSettingsPage = () => {
  const { onSignOut, pending, error } = useSignOut();

  return (
    <PageLayout
      width="wide"
      className={cn([
        "[&_[data-slot=segmented-control]]:w-42 [&_[data-slot=field-row]>label]:w-auto",
        "[&_[data-slot=field-row]>label]:flex-1 [&_[data-slot=input]]:w-35",
        "[&_[data-slot=input]]:text-right",
      ])}
      odId="settings-main"
      header={<PageHeader odId="settings" title="설정" />}
    >
      <div
        className={cn([
          "grid items-start gap-8 md:grid-cols-2",
          "[&>section>[data-slot=group-label]]:pt-0",
          "pt-5",
        ])}
      >
        <AccountSettings />
        <section data-od-id="set-appearance">
          <GroupLabel>화면</GroupLabel>
          <SettingsRow label="모드" action={<ThemeModeSelector />} />
        </section>
        <NotificationSettings />
        <HomeSettings />
        <AccountSettings section="members" />
        <HouseholdSettings />
        <AiSettings />
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
          <WithdrawAccount disabled={pending} />
          {error && (
            <Text as="p" role="alert" className="text-error-text">
              {error}
            </Text>
          )}
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
        </section>
      </div>
    </PageLayout>
  );
};

export default AppearanceSettingsPage;
