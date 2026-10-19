import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { GroupLabel } from "./group-label";
import { Text } from "./text";
type ListRowProps = ComponentProps<"li"> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  description?: string;
};
export function ListRow({
  leading,
  trailing,
  description,
  className,
  children,
  ...props
}: ListRowProps) {
  return (
    <li className={cn("kj-list-row", className)} {...props}>
      {leading}
      <div className="min-w-0 flex-1">
        <div>{children}</div>
        {description && (
          <Text as="p" variant="caption" className="text-muted-foreground">
            {description}
          </Text>
        )}
      </div>
      {trailing && <div className="kj-list-row-trailing">{trailing}</div>}
    </li>
  );
}

export function ListGroupLabel({ className, ...props }: ComponentProps<"h3">) {
  return <GroupLabel as="h3" className={className} {...props} />;
}
export function List({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("kj-list", className)} {...props} />;
}
