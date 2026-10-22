"use client";

import { EmptyState, ErrorState } from "@/shared/ui";

import AccountSettingsSkeleton from "./Skeleton";
import MemberSettings from "./Members";
import ProfileSettings from "./Profile";
import { useAccount } from "@/features/account";
import { useFamily } from "@/features/family";

interface Props {
  section?: "profile" | "members";
}

const AccountSettings = ({ section = "profile" }: Props) => {
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

  if (account.isPending || family.isPending)
    return <AccountSettingsSkeleton section={section} />;

  if (!family.data) return <EmptyState message="아직 소속된 가정이 없어요." />;

  return (
    <>
      {section === "profile" && (
        <ProfileSettings
          profile={account.data.profile}
          loginProvider={account.data.loginProvider}
        />
      )}
      {section === "members" && (
        <MemberSettings family={family.data} account={account.data} />
      )}
    </>
  );
};

export default AccountSettings;
