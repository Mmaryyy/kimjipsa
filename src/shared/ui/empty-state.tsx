import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Text } from "./text";
type EmptyStateProps = {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
};
export function EmptyState({
  message,
  icon = <Inbox size={36} />,
  action,
}: EmptyStateProps) {
  return (
    <div className="kj-empty-state">
      <div aria-hidden="true" className="kj-empty-state-icon">
        {icon}
      </div>
      <Text as="p">{message}</Text>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
