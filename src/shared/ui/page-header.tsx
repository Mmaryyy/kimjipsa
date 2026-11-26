import { cn } from "@/shared/lib";
import type { ReactNode } from "react";
import { Text } from "./text";
import { pageHeaderSubtitleStyles } from "./page-header.variants";
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
  subtitleVariant?: "default" | "context" | "context-muted";
  odId?: string;
}
const PageHeader = ({
  title,
  actions,
  subtitle,
  subtitleVariant = "default",
  odId,
  navigation,
  children,
  titleOdId,
  titleAriaLabel,
  titleId,
  headingLevel = 1,
}: Props) => {
  const contextual = subtitleVariant !== "default" && Boolean(subtitle);
  const subtitleText = subtitle && (
    <Text
      as="p"
      variant={contextual ? "body" : "body-sm"}
      className={pageHeaderSubtitleStyles({ variant: subtitleVariant })}
    >
      {subtitle}
    </Text>
  );

  return (
    <header className="kj-page-header" data-od-id={odId && `${odId}-header`}>
      <div
        className={cn(
          "relative flex gap-2",
          contextual ? "items-start" : "items-center",
        )}
      >
        {navigation && (
          <div className="-ml-3 flex shrink-0 items-center [&_a]:min-h-11 [&_a]:min-w-11">
            {navigation}
          </div>
        )}
        <div
          className={cn(
            "min-w-0 flex-1",
            contextual ? "pt-1" : "flex items-center",
          )}
        >
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
          {contextual && subtitleText}
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
      {!contextual && subtitleText}
      {children}
    </header>
  );
};
export default PageHeader;
