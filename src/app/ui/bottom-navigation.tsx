import { NavigationLinkList } from "./navigation-link-list";
export function BottomNavigation({ pathname }: { pathname: string }) {
  return (
    <nav className="kj-bottom-navigation" aria-label="하단 메뉴">
      <NavigationLinkList pathname={pathname} />
    </nav>
  );
}
