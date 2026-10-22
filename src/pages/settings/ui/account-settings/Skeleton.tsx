import { GroupLabel, Skeleton, SkeletonSection } from "@/shared/ui";

import SettingsSkeleton from "../settings-skeleton";

interface Props {
  section?: "profile" | "members";
}

const AccountSettingsSkeleton = ({ section = "profile" }: Props) => {
  return (
    <>
      {section === "profile" && (
        <SettingsSkeleton
          label="내 정보를 불러오고 있어요"
          title="내 정보"
          rows={2}
        />
      )}
      {section === "members" && (
        <section>
          <GroupLabel>구성원</GroupLabel>
          <SkeletonSection label="가정과 구성원을 불러오고 있어요">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className="flex min-h-[var(--row-min)] items-center gap-3 py-2"
              >
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1">
                  <div className="flex h-[var(--type-body-lh)] items-center">
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex h-[var(--type-caption-lh)] items-center">
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            ))}
            <div className="grid gap-3">
              <div className="flex min-h-[var(--ctl-h)] items-center">
                <Skeleton className="h-4 w-28" />
              </div>
              <div />
            </div>
          </SkeletonSection>
        </section>
      )}
    </>
  );
};

export default AccountSettingsSkeleton;
