import { FormFieldRow, Skeleton, SkeletonSection } from "@/shared/ui";

const HomeSettingsSkeleton = () => {
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
};

export default HomeSettingsSkeleton;
