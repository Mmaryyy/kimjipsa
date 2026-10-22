"use client";
import Link from "next/link";
import { FamilyRoleIcon } from "@/entities/family";
import { useAccount, ProfileForm } from "@/features/account";
import { useFamily, InviteShare } from "@/features/family";
import { accountRoutes } from "@/shared/config";
import {
  EmptyState,
  ErrorState,
  List,
  ListRow,
  ListSkeleton,
  PageHeader,
  SectionHeader,
} from "@/shared/ui";
export function FamilyPage() {
  const family = useFamily();
  const account = useAccount();
  if (family.isError || account.isError)
    return (
      <ErrorState
        message={(family.error ?? account.error)?.message}
        onRetry={() => {
          void family.refetch();
          void account.refetch();
        }}
        retrying={family.isFetching || account.isFetching}
      />
    );
  if (family.isPending || account.isPending)
    return <ListSkeleton label="가정과 구성원을 불러오고 있어요" />;
  if (!family.data)
    return (
      <EmptyState
        message="아직 소속된 가정이 없어요."
        action={<Link href={accountRoutes.onboarding}>우리 집 만들기</Link>}
      />
    );
  const members = family.data.members.map((member) => (
    <ListRow key={member.user_id}>
      <span className="whitespace-nowrap">
        {member.display_name}
        {member.role !== "member" && (
          <>
            {" "}
            <FamilyRoleIcon role={member.role} />
          </>
        )}
      </span>
    </ListRow>
  ));
  return (
    <div className="grid gap-6">
      <PageHeader title={family.data.name} />
      <section aria-labelledby="family-members-title">
        <SectionHeader title="함께 쓰는 사람" id="family-members-title" />
        {members.length === 0 ? (
          <EmptyState message="표시할 구성원이 없어요." />
        ) : (
          <List>{members}</List>
        )}
      </section>
      {account.data.membership?.role === "admin" && <InviteShare />}
      <section aria-labelledby="profile-title">
        <SectionHeader title="내 표시 이름" id="profile-title" />
        <ProfileForm displayName={account.data.profile?.displayName} />
      </section>
      <Link href={accountRoutes.home} className="text-primary">
        오늘 화면으로 가기
      </Link>
    </div>
  );
}
