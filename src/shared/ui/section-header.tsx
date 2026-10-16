import type { ReactNode } from "react";
import { Text } from "./text";
export function SectionHeader({
  title,
  action,
  id,
}: {
  title: string;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div className="kj-section-header">
      <Text as="h2" variant="title-sm" id={id}>
        {title}
      </Text>
      {action}
    </div>
  );
}
