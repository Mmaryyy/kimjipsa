"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountGate } from "@/widgets/account-gate";
import { accountRoutes, catalogPath } from "@/shared/config";
import { SidebarNavigation } from "./sidebar-navigation";
import { BottomNavigation } from "./bottom-navigation";
export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const publicPage =
    [
      accountRoutes.login,
      accountRoutes.onboarding,
      accountRoutes.terms,
      accountRoutes.privacy,
    ].some((route) => pathname === route) ||
    pathname.startsWith(`${accountRoutes.invite}/`) ||
    pathname === catalogPath;
  return (
    <div className="kj-app-layout">
      <a className="kj-skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      {!publicPage && <SidebarNavigation pathname={pathname} />}
      <main id="main-content" className="kj-app-layout-main" tabIndex={-1}>
        {publicPage ? children : <AccountGate>{children}</AccountGate>}
      </main>
      {!publicPage && <BottomNavigation pathname={pathname} />}
    </div>
  );
}
