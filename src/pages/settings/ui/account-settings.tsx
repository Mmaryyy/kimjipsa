"use client";
import { AccountSettingsSkeleton } from "./settings-skeleton";
import { cn } from "@/shared/lib";

import { useState } from "react";
import { useAccount, ProfileForm } from "@/features/account";
import { useFamily, InviteShare } from "@/features/family";
import { roles } from "@/entities/family";
import {
  EmptyState,
  ErrorState,
  GroupLabel,
  List,
  ListRow,
  Sheet,
  Text,
  TextButton,
} from "@/shared/ui";

export function AccountSettings() {
  const [editingName, setEditingName] = useState(false);
  const account = useAccount();
  const family = useFamily();
  if (account.isError || family.isError) {
    const failed = account.isError ? account : family;
    return (
      <ErrorState
        message={failed.error?.message ?? "정보를 불러오지 못했어요."}
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );
  }
  if (account.isPending || family.isPending) return <AccountSettingsSkeleton />;
  const currentAccount = account.data;
  if (!family.data) return <EmptyState message="아직 소속된 가정이 없어요." />;
  return (
    <>
      <section data-od-id="set-profile">
        <GroupLabel>내 정보</GroupLabel>
        <Sheet
          open={editingName}
          onOpenChange={setEditingName}
          title="표시 이름 수정"
          description="표시 이름은 6자 이하로 입력해 주세요."
          trigger={
            <TextButton
              data-od-id="s-display-name"
              className="flex min-h-11 w-full justify-between text-body font-normal text-foreground"
            >
              <span>표시 이름</span>
              <Text variant="body-sm" className="text-muted-foreground">
                {currentAccount.profile?.displayName}
              </Text>
            </TextButton>
          }
        >
          <ProfileForm
            autoFocus
            displayName={currentAccount.profile?.displayName}
            onSaved={() => setEditingName(false)}
          />
        </Sheet>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <span>로그인</span>
          <Text variant="body-sm" className="text-muted-foreground">
            {currentAccount.loginProvider === "kakao"
              ? "카카오 계정"
              : currentAccount.loginProvider === "google"
                ? "Google 계정"
                : "로그인 수단을 확인할 수 없어요"}
          </Text>
        </div>
      </section>
      <section data-od-id="set-members">
        <GroupLabel>{family.data.name} 구성원</GroupLabel>
        <List>
          {family.data.members.map((member) => {
            const isMe = member.user_id === currentAccount.userId;
            return (
              <ListRow
                key={member.user_id}
                data-od-id={isMe ? "member-me" : "member-partner"}
                leading={
                  <span
                    className={cn([
                      "grid size-8 place-items-center rounded-[var(--r-round)] bg-muted",
                      "text-[length:var(--type-caption-size)] font-semibold text-muted-foreground",
                    ])}
                  >
                    {Array.from(member.display_name)[0]}
                  </span>
                }
                description={roles[member.role]}
              >
                {member.display_name}
                {isMe && " (나)"}
              </ListRow>
            );
          })}
        </List>
        {currentAccount.membership?.role === "admin" && <InviteShare />}
      </section>
    </>
  );
}
