import { Skeleton, SkeletonSection } from "@/shared/ui";

const EventFormSkeleton = () => (
  <SkeletonSection label="카테고리를 불러오고 있어요">
    <Skeleton className="h-96" />
  </SkeletonSection>
);

export default EventFormSkeleton;
