import type { ReactNode } from "react";
import { SectionHeader, Skeleton, SkeletonSection } from "@/shared/ui";

export function EventListSkeleton({
  title,
  action,
  dday = false,
}: {
  title: string;
  action?: ReactNode;
  dday?: boolean;
}) {
  const particle = dday ? "를" : "을";
  return (
    <div data-slot={dday ? "dday-skeleton" : undefined}>
      <SkeletonSection label={`${title}${particle} 불러오고 있어요`}>
        <SectionHeader title={title} action={action} />
        <Skeleton />
      </SkeletonSection>
    </div>
  );
}
