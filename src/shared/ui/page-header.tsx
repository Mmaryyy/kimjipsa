import { cn } from "@/shared/lib";
import type { ReactNode } from "react";
import { Text } from "./text";
export function PageHeader({
  title,
  actions,
  subtitle,
  odId,
  navigation,
  children,
  titleOdId,
  titleAriaLabel,
}: {
  title: string;
  titleAriaLabel?: string;
  actions?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
  titleOdId?: string;
  subtitle?: string;
  odId?: string;
}) {
  return (
    <header className="kj-page-header" data-od-id={odId && `${odId}-header`}>
      {navigation}
      {subtitle && (
        <Text as="p" variant="body-sm" className="text-muted-foreground">
          {subtitle}
        </Text>
      )}
      <div className="relative flex items-center gap-2 [&_h1]:min-w-0 [&_h1]:flex-1">
        <div className="flex min-w-0 flex-1 items-center">
          <Text
            as="h1"
            aria-label={titleAriaLabel}
            variant="title-lg"
            data-od-id={titleOdId ?? (odId && `${odId}-title`)}
          >
            {title}
          </Text>
        </div>
        {actions && (
          <div
            className={cn([
              "flex min-w-0 max-w-3/5 flex-wrap items-center justify-end gap-2 [&>*]:max-w-full",
              "[&>*]:[overflow-wrap:anywhere]",
            ])}
          >
            {actions}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}
