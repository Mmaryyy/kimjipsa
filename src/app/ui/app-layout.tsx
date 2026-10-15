"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarNavigation } from "./sidebar-navigation";
import { BottomNavigation } from "./bottom-navigation";
export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="kj-app-layout">
      <a className="kj-skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <SidebarNavigation pathname={pathname} />
      <main id="main-content" className="kj-app-layout-main" tabIndex={-1}>
        {children}
      </main>
      <BottomNavigation pathname={pathname} />
    </div>
  );
}
