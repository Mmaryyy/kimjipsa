import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

export function GroupLabel({
  as: Tag = "h2",
  className,
  ...props
}: ComponentProps<"h2"> & { as?: "h2" | "h3" | "span" }) {
  return <Tag className={cn("kj-group-label", className)} {...props} />;
}
