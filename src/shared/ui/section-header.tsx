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
    <div
      data-slot="section-header"
      className="mt-8 mb-2 flex flex-wrap items-center justify-between gap-2"
    >
      <Text as="h2" variant="title-sm" id={id} data-od-id={id}>
        {title}
      </Text>
      {action}
    </div>
  );
}
