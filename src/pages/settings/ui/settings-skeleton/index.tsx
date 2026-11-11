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
        <Skeleton style={{ height: `calc(var(--ctl-h) * ${rows})` }} />
      </SkeletonSection>
    </section>
  );
};

export default SettingsSkeleton;
