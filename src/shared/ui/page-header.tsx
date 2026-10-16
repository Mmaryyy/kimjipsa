import type { ReactNode } from "react";
import { Text } from "./text";
export function PageHeader({
  title,
  actions,
  subtitle,
}: {
  title: string;
  actions?: ReactNode;
  subtitle?: string;
}) {
  return (
    <header className="kj-page-header">
      <div className="kj-page-header-row">
        <Text as="h1" variant="title-lg">
          {title}
        </Text>
        {actions && <div className="kj-page-header-toolbar">{actions}</div>}
      </div>
      {subtitle && (
        <Text as="p" variant="body-sm" className="text-muted-foreground">
          {subtitle}
        </Text>
      )}
    </header>
  );
}
