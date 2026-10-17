"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountGate } from "@/widgets/account-gate";
import { accountRoutes, catalogPath } from "@/shared/config";
import { SidebarNavigation } from "./sidebar-navigation";
import { BottomNavigation } from "./bottom-navigation";
const MockDataToolbar =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("./mock-data-toolbar").then(
            (module) => module.MockDataToolbar,
          ),
        { ssr: false },
      )
    : () => null;

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
        {process.env.NODE_ENV === "development" && <MockDataToolbar />}
        {publicPage ? children : <AccountGate>{children}</AccountGate>}
      </main>
      {!publicPage && <BottomNavigation pathname={pathname} />}
    </div>
  );
}
