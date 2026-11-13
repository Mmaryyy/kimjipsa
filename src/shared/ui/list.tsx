import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { GroupLabel } from "./group-label";
import { Text } from "./text";
type ListRowProps = HTMLAttributes<HTMLElement> & {
  as?: "li" | "div";
  leading?: ReactNode;
  trailing?: ReactNode;
  description?: string;
};
export function ListRow({
  as: Component = "li",
  leading,
  trailing,
  description,
  className,
  children,
  ...props
}: ListRowProps) {
  return (
    <Component
      className={cn(
        "flex min-h-[var(--row-min)] items-center gap-3 py-2 [overflow-wrap:anywhere]",
        className,
      )}
      {...props}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {description && (
          <Text as="p" variant="caption" className="text-muted-foreground">
            {description}
          </Text>
        )}
      </div>
      {trailing && <div className="max-w-13/20 flex-none">{trailing}</div>}
    </Component>
  );
}

export function ListGroupLabel({ className, ...props }: ComponentProps<"h3">) {
  return <GroupLabel as="h3" className={className} {...props} />;
}
export function List({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("m-0 list-none p-0", className)} {...props} />;
}
