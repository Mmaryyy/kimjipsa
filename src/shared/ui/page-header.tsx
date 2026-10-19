import { cn } from "@/shared/lib";
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
      <div className="flex items-center gap-2 [&_h1]:min-w-0 [&_h1]:flex-1">
        <Text
          as="h1"
          variant={titleVariant}
          data-od-id={titleOdId ?? (odId && `${odId}-title`)}
        >
          {title}
        </Text>
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
