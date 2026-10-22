import { GroupLabel, Skeleton, SkeletonSection } from "@/shared/ui";

interface Props {
  label: string;
  rows: number;
  title?: string;
}

const SettingsSkeleton = ({ label, rows, title }: Props) => {
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
};

export default SettingsSkeleton;
