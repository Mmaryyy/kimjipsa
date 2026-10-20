import {
  GroupLabel,
  List,
  ListRow,
  SectionHeader,
  Skeleton,
  SkeletonSection,
} from "@/shared/ui";

export function EventRowsSkeleton({
  rows = 3,
  grouped = false,
  dday = false,
  interactive = false,
}: {
  rows?: number;
  grouped?: boolean;
  dday?: boolean;
  interactive?: boolean;
}) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index}>
          {grouped && (
            <GroupLabel as="h3">
              <Skeleton className="h-3 w-28" />
            </GroupLabel>
          )}
          <List>
            <ListRow
              leading={
                <>
                  {!dday && <Skeleton className="h-3 w-[60px] shrink-0" />}
                  <Skeleton className="size-2.5 shrink-0 rounded-full" />
                </>
              }
              trailing={dday && <Skeleton className="h-7 w-16" />}
            >
              <div
                className={
                  interactive
                    ? "flex h-[var(--ctl-h)] items-center"
                    : "flex h-[var(--type-body-lh)] items-center"
                }
              >
                <Skeleton className="h-4 w-32 max-w-full" />
              </div>
              <div className="flex h-[var(--type-caption-lh)] items-center">
                <Skeleton className="h-3 w-20" />
              </div>
            </ListRow>
          </List>
        </div>
      ))}
    </div>
  );
}

export function EventListSkeleton({
  title,
  ...props
}: {
  title: string;
  rows?: number;
  grouped?: boolean;
  dday?: boolean;
  interactive?: boolean;
}) {
  const particle = props.dday ? "를" : "을";
  return (
    <SkeletonSection label={`${title}${particle} 불러오고 있어요`}>
      <SectionHeader title={title} />
      <EventRowsSkeleton {...props} />
    </SkeletonSection>
  );
}
