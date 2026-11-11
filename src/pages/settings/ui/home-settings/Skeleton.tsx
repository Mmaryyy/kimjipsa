import { Skeleton, SkeletonSection } from "@/shared/ui";

const HomeSettingsSkeleton = () => (
  <SkeletonSection label="홈 설정을 불러오고 있어요">
    <Skeleton className="h-40" />
  </SkeletonSection>
);

export default HomeSettingsSkeleton;
