import type { VariantProps } from "class-variance-authority";
import { emptyStateStyles } from "./ui.variants";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Text } from "./text";
type EmptyStateProps = VariantProps<typeof emptyStateStyles> & {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
};
export function EmptyState({
  message,
  icon = <Inbox size={36} />,
  action,
  layout,
}: EmptyStateProps) {
  return (
    <div className={emptyStateStyles({ layout })}>
      {icon !== null && (
        <div aria-hidden="true" className="kj-empty-state-icon">
          {icon}
        </div>
      )}
      <Text as="p">{message}</Text>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
