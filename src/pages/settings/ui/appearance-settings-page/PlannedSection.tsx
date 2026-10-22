import { GroupLabel, Text } from "@/shared/ui";

interface Props {
  title: string;
  odId: string;
}

const PlannedSettingsSection = ({ title, odId }: Props) => {
  return (
    <section data-od-id={odId} aria-label={title}>
      <GroupLabel>{title}</GroupLabel>
      <Text as="p" variant="caption" className="text-muted-foreground">
        준비 중이에요.
      </Text>
    </section>
  );
};

export default PlannedSettingsSection;
