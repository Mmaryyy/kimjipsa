import { cn } from "@/shared/lib";
import type { ReactNode } from "react";
import { Text } from "./text";
interface Props {
  title: string;
  titleAriaLabel?: string;
  titleId?: string;
  headingLevel?: 1 | 2 | 3;
  actions?: ReactNode;
  navigation?: ReactNode;
  children?: ReactNode;
  titleOdId?: string;
  subtitle?: string;
  odId?: string;
}
const PageHeader = ({
  title,
  actions,
  subtitle,
  odId,
  navigation,
  children,
  titleOdId,
  titleAriaLabel,
  titleId,
  headingLevel = 1,
}: Props) => {
  return (
    <header className="kj-page-header" data-od-id={odId && `${odId}-header`}>
      <div className="relative flex items-center gap-2">
        {navigation && (
          <div className="-ml-3 flex shrink-0 items-center [&_a]:min-h-11 [&_a]:min-w-11">
            {navigation}
          </div>
        )}
        <div className="flex min-w-0 flex-1 items-center">
          <Text
            as={`h${headingLevel}`}
            className={cn("min-w-0 flex-1", navigation && "truncate")}
            id={titleId}
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
              "[&_button:not(.glass-surface)]:h-[var(--ctl-h)] [&_button:not(.glass-surface)]:min-h-[var(--ctl-h)]",
            ])}
          >
            {actions}
          </div>
        )}
      </div>
      {subtitle && (
        <Text as="p" variant="body-sm" className="mt-1 text-muted-foreground">
          {subtitle}
        </Text>
      )}
      {children}
    </header>
  );
};
export default PageHeader;
