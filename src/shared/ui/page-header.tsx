import type { ReactNode } from "react";
import { Text } from "./text";
export function PageHeader({
  title,
  actions,
  subtitle,
  odId,
  titleVariant = "title-lg",
  navigation,
  children,
  titleOdId,
}: {
  title: string;
  actions?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
  titleOdId?: string;
  subtitle?: string;
  odId?: string;
  titleVariant?: "title-lg" | "display";
}) {
  return (
    <header className="kj-page-header" data-od-id={odId && `${odId}-header`}>
      {navigation}
      {subtitle && (
        <Text as="p" variant="body-sm" className="text-muted-foreground">
          {subtitle}
        </Text>
      )}
      <div className="kj-page-header-row">
        <Text
          as="h1"
          variant={titleVariant}
          data-od-id={titleOdId ?? (odId && `${odId}-title`)}
        >
          {title}
        </Text>
        {actions && <div className="kj-page-header-toolbar">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
