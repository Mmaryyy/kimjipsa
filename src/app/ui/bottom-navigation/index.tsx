"use client";
import Link from "next/link";
import { cn, isCurrentPath } from "@/shared/lib";
import { cartRoutes } from "@/shared/config";
import { appNavigation } from "../../config";
import { useTabLens } from "./use-tab-lens";

const hrefs = appNavigation.map((item) => item.href);
const faceClass = cn([
  "flex min-h-11 flex-col items-center justify-center gap-0.5",
  "text-[length:calc(var(--sp-2)+var(--sp-half))] leading-[var(--lh-caption2)] whitespace-nowrap",
  "[&_svg]:size-[var(--bottom-navigation-icon-size)]",
]);

interface Props {
  pathname: string;
}
const BottomNavigation = ({ pathname }: Props) => {
  const nav = useTabLens(hrefs);
  return (
    <nav
      ref={nav}
      aria-label="하단 메뉴"
      className={cn([
        "fixed inset-x-3 bottom-[calc(var(--bottom-navigation-bottom)+env(safe-area-inset-bottom,0px))] z-40",
        "mx-auto max-w-120 lg:hidden",
        "touch-pan-y select-none",
      ])}
    >
      <div
        data-rail
        className="glass-surface relative min-h-[var(--bottom-navigation-height)] px-1 py-1"
      >
        <ul data-original className="relative grid grid-cols-5">
          {appNavigation.map(({ href, label, icon: Icon }) => {
            const active =
              isCurrentPath(pathname, href) ||
              (href === cartRoutes.cart &&
                isCurrentPath(pathname, cartRoutes.restock));
            return (
              <li key={href}>
                <Link
                  href={href}
                  draggable={false}
                  aria-current={active ? "page" : undefined}
                  className={cn([
                    "relative flex min-h-14 items-center justify-center rounded-[var(--r-round)] text-muted-foreground",
                    "[&:not([aria-current=page])_svg]:text-[var(--icon-secondary)]",
                    "aria-[current=page]:text-primary",
                    "forced-colors:aria-[current=page]:outline forced-colors:aria-[current=page]:outline-2",
                  ])}
                >
                  {active && (
                    <span
                      data-selection
                      aria-hidden="true"
                      className={cn([
                        "pointer-events-none absolute inset-0 rounded-[inherit]",
                        "bg-[var(--glass-selected-bg)] shadow-[var(--glass-selected-shadow)]",
                      ])}
                    />
                  )}
                  <span className={cn(faceClass, "relative")}>
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          aria-hidden="true"
          data-lens
          className={cn([
            "pointer-events-none absolute top-1 bottom-1 left-1 w-[var(--tab-cell)] rounded-[var(--r-round)] opacity-0",
            "border border-[var(--glass-border)] bg-[var(--tab-lens-bg)] shadow-[var(--tab-lens-shadow)]",
            "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
            "before:bg-[var(--tab-lens-edge)] before:opacity-[var(--glass-optics-opacity)]",
            "before:[mask:linear-gradient(var(--glass-text)_0_0)_content-box,linear-gradient(var(--glass-text)_0_0)]",
            "before:[mask-composite:exclude] before:p-px",
            "forced-colors:hidden motion-reduce:hidden",
          ])}
        />
        <div
          data-copy
          aria-hidden="true"
          inert
          className={cn([
            "pointer-events-none absolute inset-x-1 top-1 grid grid-cols-5",
            "text-primary opacity-0",
            "forced-colors:hidden motion-reduce:hidden",
          ])}
        >
          {appNavigation.map(({ href, label, icon: Icon }) => (
            <div
              key={href}
              className="flex min-h-14 items-center justify-center"
            >
              <span data-face className={faceClass}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};
export default BottomNavigation;
