import type { ReactNode } from "react";
import { Text } from "./text";
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="kj-section-header">
      <Text as="h2" variant="title-sm">
        {title}
      </Text>
      {action}
    </div>
  );
}
