import Link from "next/link";
import { cn } from "@/shared/lib";
import { segmentedStyles } from "./ui.variants";

interface Props {
  label: string;
  links: readonly { href: string; label: string }[];
  current: string;
  className?: string;
  odId?: string;
}

export function SegmentedNavigation({
  label,
  links,
  current,
  className,
  odId,
}: Props) {
  return (
    <nav
      aria-label={label}
      data-od-id={odId}
      className={cn(segmentedStyles({ mode: "navigation" }), className)}
    >
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className="kj-hit text-label"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
