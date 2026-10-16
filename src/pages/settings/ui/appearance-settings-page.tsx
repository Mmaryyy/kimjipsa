"use client";

import Link from "next/link";
import { useSignOut } from "@/features/account";
import { accountRoutes } from "@/shared/config";
import {
  Button,
  Text,
  ThemeModeSelector,
  SectionHeader,
  PageHeader,
} from "@/shared/ui";

export function AppearanceSettingsPage() {
  const { onSignOut, pending, error } = useSignOut();

  return (
    <>
      <PageHeader title="설정" />
      <Link href={accountRoutes.family} className="text-primary">
        가정·구성원·표시 이름 관리하기
      </Link>
      <section>
        <SectionHeader title="화면 모드" />
        <ThemeModeSelector />
      </section>
      <section aria-labelledby="account-settings-title">
        <SectionHeader id="account-settings-title" title="계정" />
        <Button onClick={onSignOut} disabled={pending} aria-busy={pending}>
          로그아웃
        </Button>
        {error && (
          <Text as="p" role="alert" className="text-error-text">
            {error}
          </Text>
        )}
      </section>
    </>
  );
}
