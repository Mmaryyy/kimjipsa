"use client";
import { SkeletonStatus } from "@/shared/ui";
import { cn } from "@/shared/lib";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AccountGate } from "@/widgets/account-gate";
import {
  accountRoutes,
  catalogPath,
  viewportPath,
  viewportSpacingPath,
} from "@/shared/config";
import { SidebarNavigation } from "./sidebar-navigation";
import BottomNavigation from "./bottom-navigation";
import { SplashScreen } from "./splash-screen";
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
      viewportPath,
      viewportSpacingPath,
    ].some((route) => pathname === route) ||
    pathname.startsWith(`${accountRoutes.invite}/`) ||
    pathname === catalogPath;
  const shell = (
    <div
      className="group/app min-h-dvh lg:pl-62 data-[public=true]:pl-0"
      data-public={publicPage}
    >
      <a
        className="fixed top-2 left-4 z-100 -translate-y-2/1 bg-background p-2 focus:translate-y-0"
        href="#main-content"
      >
        본문으로 건너뛰기
      </a>
      {!publicPage && <SidebarNavigation pathname={pathname} />}
      <main
        id="main-content"
        className={cn([
          "mx-auto min-w-0 max-w-[var(--content-max)] bg-background px-4 pt-0",
          "pb-[calc(var(--bottom-navigation-offset)+env(safe-area-inset-bottom))] lg:max-w-280",
          "lg:px-10 lg:pb-10",
          "group-data-[public=true]/app:pb-0",
        ])}
        tabIndex={-1}
      >
        {process.env.NODE_ENV === "development" && <MockDataToolbar />}
        <SkeletonStatus key={pathname}>{children}</SkeletonStatus>
      </main>
      {!publicPage && <BottomNavigation pathname={pathname} />}
    </div>
  );
  return publicPage ? (
    shell
  ) : (
    <AccountGate splash={(leaving) => <SplashScreen leaving={leaving} />}>
      {shell}
    </AccountGate>
  );
}
