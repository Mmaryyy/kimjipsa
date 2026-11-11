import { GroupLabel, Skeleton, SkeletonSection } from "@/shared/ui";

const AiSettingsSkeleton = () => (
  <>
    <section>
      <GroupLabel>AI 집사</GroupLabel>
      <SkeletonSection label="집사 설정을 불러오고 있어요">
        <Skeleton className="h-64" />
      </SkeletonSection>
    </section>
    <section>
      <GroupLabel>가족 기억</GroupLabel>
      <SkeletonSection label="가족 기억을 불러오고 있어요">
        <Skeleton />
      </SkeletonSection>
    </section>
  </>
);

export default AiSettingsSkeleton;
