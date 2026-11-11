import { Skeleton, SkeletonSection } from "./skeleton";

export function ListSkeleton({
  label = "목록을 불러오고 있어요",
}: {
  label?: string;
}) {
  return (
    <SkeletonSection label={label}>
      <Skeleton />
    </SkeletonSection>
  );
}
