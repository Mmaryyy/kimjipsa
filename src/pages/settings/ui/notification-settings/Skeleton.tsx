import { Skeleton, SkeletonSection } from "@/shared/ui";

const NotificationSettingsSkeleton = () => (
  <SkeletonSection label="알림 설정을 불러오고 있어요">
    <Skeleton className="h-56" />
  </SkeletonSection>
);

export default NotificationSettingsSkeleton;
