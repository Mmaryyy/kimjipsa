import type { ComponentProps, ReactNode } from "react";
import {
  CircleCheck,
  Info,
  TriangleAlert,
  CircleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib";
import type { StatusVariant } from "./ui.variants";
import { bannerStyles, statusBadgeStyles } from "./ui.variants";
const statusIcons = {
  success: CircleCheck,
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
} satisfies Record<StatusVariant, LucideIcon>;
type BannerProps = ComponentProps<"div"> & {
  variant?: StatusVariant;
  title: string;
  icon?: ReactNode;
};
export function Banner({
  variant = "info",
  title,
  icon,
  className,
  children,
  ...props
}: BannerProps) {
  const Icon = statusIcons[variant];
  return (
    <div className={cn(bannerStyles({ variant }), className)} {...props}>
      <span className={statusBadgeStyles({ variant })} aria-hidden="true">
        {icon ?? <Icon size={16} />}
      </span>
      <div className="min-w-0">
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
