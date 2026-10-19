"use client";
import Link from "next/link";
import { useAccount } from "@/features/account";
import { useFamily } from "@/features/family";
import { accountRoutes } from "@/shared/config";
import { NavigationLinkList } from "./navigation-link-list";
export function SidebarNavigation({ pathname }: { pathname: string }) {
  const account = useAccount();
  const family = useFamily();
  const memberNames = family.data?.members
    .map((member) => member.display_name)
    .join(" · ");
  return (
    <nav className="kj-sidebar-navigation" aria-label="주 메뉴">
      <Link href={accountRoutes.home} className="kj-sidebar-household">
        <span className="text-headline">{family.data?.name ?? "우리 집"}</span>
        <small className="text-caption text-muted-foreground">
          {memberNames}
        </small>
      </Link>
      <NavigationLinkList pathname={pathname} />
      <div className="kj-sidebar-account">
        {account.data?.profile?.displayName}
        {account.data?.membership?.role === "admin" && " · 관리자"}
      </div>
    </nav>
  );
}
