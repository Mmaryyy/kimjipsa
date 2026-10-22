import { FormFieldRow, Skeleton, SkeletonSection } from "@/shared/ui";

const NotificationSettingsSkeleton = () => {
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
};

export default NotificationSettingsSkeleton;
