import { Skeleton, SkeletonSection } from "@/shared/ui";

const RestockSkeleton = () => (
  <SkeletonSection label="구매한 품목을 불러오고 있어요">
    <Skeleton className="h-80" />
  </SkeletonSection>
);

export default RestockSkeleton;
