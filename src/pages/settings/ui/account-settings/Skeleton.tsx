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
            <Skeleton />
          </SkeletonSection>
        </section>
      )}
    </>
  );
};

export default AccountSettingsSkeleton;
