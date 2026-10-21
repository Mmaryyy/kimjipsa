import {
  FormFieldRow,
  GroupLabel,
  Skeleton,
  SkeletonSection,
} from "@/shared/ui";

export function SettingsSkeleton({
  label,
  rows,
  title,
}: {
  label: string;
  rows: number;
  title?: string;
}) {
  return (
    <section>
      {title && <GroupLabel>{title}</GroupLabel>}
      <SkeletonSection label={label}>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex min-h-11 items-center justify-between gap-3"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </SkeletonSection>
    </section>
  );
}

export function HomeSettingsSkeleton() {
  return (
    <SkeletonSection label="홈 설정을 불러오고 있어요">
      <div className="grid min-w-0 gap-2">
        <FormFieldRow label="다가오는 일정" htmlFor="loading-upcoming-enabled">
          {() => <Skeleton className="h-6.25 w-10.5 rounded-full" />}
        </FormFieldRow>
        <FormFieldRow label="캘린더 보기" htmlFor="loading-home-view">
          {() => (
            <Skeleton className="h-[calc(var(--ctl-h-xs)+var(--sp-1))] w-42" />
          )}
        </FormFieldRow>
        <FormFieldRow label="표시 개수" htmlFor="loading-upcoming-count">
          {() => (
            <Skeleton className="h-[calc(var(--ctl-h-xs)+var(--sp-1))] w-42" />
          )}
        </FormFieldRow>
      </div>
    </SkeletonSection>
  );
}

export function AccountSettingsSkeleton({
  section = "profile",
}: {
  section?: "profile" | "members";
}) {
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
}

export function NotificationSettingsSkeleton() {
  return (
    <SkeletonSection label="알림 설정을 불러오고 있어요">
      <FormFieldRow label="웹 푸시 알림" htmlFor="loading-push">
        {() => <Skeleton className="h-6.25 w-10.5 rounded-full" />}
      </FormFieldRow>
      <FormFieldRow label="아침 요약" htmlFor="loading-morning">
        {() => <Skeleton className="h-4 w-20" />}
      </FormFieldRow>
      <div className="py-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-1 h-3 w-1/2" />
      </div>
    </SkeletonSection>
  );
}
