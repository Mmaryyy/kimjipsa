"use client";
import Link from "next/link";
import type { CSSProperties } from "react";
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

const faceMask = {
  "--cutout-left": "calc(var(--lens-left) - var(--face-left))",
  "--cutout-top": "calc(var(--lens-top) - var(--face-top))",
  maskImage: [
    "linear-gradient(var(--glass-text) 0 0)",
    "linear-gradient(var(--tab-face-cutout) 0 0)",
    "radial-gradient(ellipse closest-side, var(--tab-face-cutout) 99%, transparent 100%)",
    "radial-gradient(ellipse closest-side, var(--tab-face-cutout) 99%, transparent 100%)",
  ].join(","),
  maskSize: [
    "100% 100%",
    "calc(var(--lens-width) - 2 * var(--lens-radius)) var(--lens-height)",
    "calc(2 * var(--lens-radius)) var(--lens-height)",
    "calc(2 * var(--lens-radius)) var(--lens-height)",
  ].join(","),
  maskPosition: [
    "0 0",
    "calc(var(--cutout-left) + var(--lens-radius)) var(--cutout-top)",
    "var(--cutout-left) var(--cutout-top)",
    "calc(var(--cutout-left) + var(--lens-width) - 2 * var(--lens-radius)) var(--cutout-top)",
  ].join(","),
  maskRepeat: "no-repeat",
  maskComposite: "exclude, add, add",
} as CSSProperties;
const indicatorTransform =
  "translate3d(var(--indicator-x,var(--indicator-default-x)),0,0) " +
  "scale(var(--indicator-sx),var(--indicator-sy))";

interface Props {
  pathname: string;
}
const BottomNavigation = ({ pathname }: Props) => {
  const nav = useTabLens(hrefs);
  const activeIndex = appNavigation.findIndex(
    ({ href }) =>
      isCurrentPath(pathname, href) ||
      (href === cartRoutes.cart && isCurrentPath(pathname, cartRoutes.restock)),
  );
  return (
    <nav
      ref={nav}
      aria-label="하단 메뉴"
      style={
        {
          "--tab-cell": `calc((100% - 8px) / ${hrefs.length})`,
          "--indicator-default-x": `${Math.max(0, activeIndex) * 100}%`,
          "--indicator-sx": 1,
          "--indicator-sy": 1,
          "--selection-visible": activeIndex >= 0 ? 1 : 0,
        } as CSSProperties
      }
      className={cn([
        "fixed inset-x-3 bottom-[calc(var(--bottom-navigation-bottom)+env(safe-area-inset-bottom,0px))] z-40",
        "mx-auto max-w-120 lg:hidden",
        "group touch-pan-y select-none [-webkit-touch-callout:none]",
        "[--lens-reveal:calc(var(--lens-lift,0)*var(--glass-optics-opacity))]",
        "motion-reduce:[--lens-reveal:0] forced-colors:[--lens-reveal:0]",
      ])}
    >
      <div
        data-rail
        style={{ transform: "scale(var(--rail-scale))" }}
        className={cn([
          "glass-surface relative min-h-[var(--bottom-navigation-height)] px-1 py-1",
          "group-data-[animating]:will-change-transform",
        ])}
      >
        <span
          data-selection
          style={{
            transform: indicatorTransform,
            opacity:
              "calc((1 - var(--lens-reveal)) * var(--selection-visible))",
          }}
          aria-hidden="true"
          className={cn([
            "pointer-events-none absolute top-1 bottom-1 left-1 w-[var(--tab-cell)] rounded-[var(--r-round)]",
            "bg-[var(--glass-selected-bg)] shadow-[var(--glass-selected-shadow)]",
            "group-data-[animating]:will-change-transform",
          ])}
        />
        <ul data-original className="relative grid grid-cols-5">
          {appNavigation.map(({ href, label, icon: Icon }, index) => {
            const active = index === activeIndex;
            return (
              <li key={href}>
                <Link
                  href={href}
                  draggable={false}
                  aria-current={active ? "page" : undefined}
                  className={cn([
                    "relative flex min-h-14 items-center justify-center rounded-[var(--r-round)] text-muted-foreground",
                    "[&:not([aria-current=page])_svg]:text-[var(--icon-secondary)]",
                    "aria-[current=page]:text-[var(--tab-active-color)]",
                    "forced-colors:aria-[current=page]:outline forced-colors:aria-[current=page]:outline-2",
                  ])}
                >
                  <span
                    data-original-face
                    style={
                      {
                        ...faceMask,
                        "--face-left": `calc(${index} * var(--tab-cell))`,
                        "--face-top": "0px",
                      } as CSSProperties
                    }
                    className="flex min-h-14 w-full items-center justify-center"
                  >
                    <span className={faceClass}>
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          aria-hidden="true"
          data-lens
          style={{
            transform: indicatorTransform,
            opacity: "var(--lens-reveal)",
          }}
          className={cn([
            "pointer-events-none absolute top-1 bottom-1 left-1 w-[var(--tab-cell)]",
            "overflow-hidden rounded-[var(--r-round)] opacity-0 group-data-[animating]:will-change-transform",
            "border border-[var(--glass-border)] bg-[var(--tab-lens-bg)] shadow-[var(--tab-lens-shadow)]",
            "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
            "before:bg-[var(--tab-lens-edge)] before:opacity-[var(--glass-optics-opacity)]",
            "before:[mask:linear-gradient(var(--glass-text)_0_0)_content-box,linear-gradient(var(--glass-text)_0_0)]",
            "before:[mask-composite:exclude] before:p-px",
            "forced-colors:hidden motion-reduce:hidden",
          ])}
        >
          <div
            data-copy
            style={{
              transformOrigin:
                "calc(var(--indicator-x) + var(--tab-cell) / 2) 50%",
              transform:
                "translate3d(calc(-1 * var(--indicator-x)),0,0) scale(var(--copy-sx),var(--copy-sy))",
            }}
            aria-hidden="true"
            inert
            className={cn([
              "pointer-events-none absolute inset-y-0 left-0 grid w-[calc(var(--tab-cell)*5)] grid-cols-5",
              "text-primary",
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
      </div>
    </nav>
  );
};
export default BottomNavigation;
