import { cn } from "@/shared/lib";
import { NavigationLinkList } from "./navigation-link-list";
export function BottomNavigation({ pathname }: { pathname: string }) {
  return (
    <nav
      className={cn([
        "fixed inset-x-0 bottom-0 z-40 bg-[var(--bg-grouped-secondary)] px-1 pt-2",
        "pb-[calc(var(--sp-1)+env(safe-area-inset-bottom))] shadow-[var(--shadow-navigation)]",
        "lg:hidden [&_ul]:grid [&_ul]:grid-cols-5",
        "[&_a_svg]:size-[var(--bottom-navigation-icon-size)] [&_a]:flex [&_a]:min-h-[var(--hit)]",
        "[&_a]:flex-col [&_a]:items-center [&_a]:justify-center [&_a]:gap-1",
        "[&_a]:text-[length:calc(var(--sp-2)+var(--sp-half))] [&_a]:whitespace-nowrap",
        "[&_a]:text-muted-foreground",
        "[&_a:not([aria-current=page])_svg]:text-[var(--icon-secondary)]",
        "[&_a[aria-current=page]]:text-primary",
      ])}
      aria-label="하단 메뉴"
    >
      <NavigationLinkList pathname={pathname} />
    </nav>
  );
}
