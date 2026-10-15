import Link from "next/link";
import { catalogPath } from "@/shared/config";
import { NavigationLinkList } from "./navigation-link-list";
export function SidebarNavigation({ pathname }: { pathname: string }) {
  return (
    <nav className="kj-sidebar-navigation" aria-label="주 메뉴">
      <Link href="/" className="text-title">
        김집사
      </Link>
      <NavigationLinkList pathname={pathname} />
      {process.env.NODE_ENV === "development" && (
        <Link href={catalogPath} className="text-caption">
          컴포넌트 살펴보기
        </Link>
      )}
    </nav>
  );
}
