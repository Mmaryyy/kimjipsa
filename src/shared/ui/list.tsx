import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { GroupLabel } from "./group-label";
import { Text } from "./text";
import { listRowStyles, listStyles } from "./ui.variants";

type ListRowProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof listRowStyles> & {
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
  size,
  className,
  children,
  ...props
}: ListRowProps) {
  return (
    <Component className={cn(listRowStyles({ size }), className)} {...props}>
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
export function List({
  className,
  variant,
  ...props
}: ComponentProps<"ul"> & VariantProps<typeof listStyles>) {
  return <ul className={cn(listStyles({ variant }), className)} {...props} />;
}
