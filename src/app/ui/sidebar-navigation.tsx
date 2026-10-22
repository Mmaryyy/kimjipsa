"use client";
import { cn } from "@/shared/lib";

import Link from "next/link";
import { useAccount } from "@/features/account";
import { useFamily } from "@/features/family";
import { FamilyRoleIcon } from "@/entities/family";
import { accountRoutes } from "@/shared/config";
import { NavigationLinkList } from "./navigation-link-list";
export function SidebarNavigation({ pathname }: { pathname: string }) {
  const account = useAccount();
  const family = useFamily();
  const memberNames = family.data?.members
    .map((member) => member.display_name)
    .join(" · ");
  return (
    <nav
      className={cn([
        "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-62 lg:flex-col lg:gap-8 lg:bg-card",
        "lg:px-3 lg:py-5 lg:[&_li_a]:flex lg:[&_li_a]:min-h-8 lg:[&_li_a]:items-center",
        "lg:[&_li_a]:gap-2 lg:[&_li_a]:rounded-sm lg:[&_li_a]:px-3 lg:[&_li_a]:whitespace-nowrap",
        "lg:[&_li_a]:text-foreground",
        "lg:[&_li_a:not([aria-current=page])_svg]:text-[var(--icon-secondary)]",
        "lg:[&_li_a[aria-current=page]_svg]:text-primary lg:[&_li_a[aria-current=page]]:bg-muted",
      ])}
      aria-label="주 메뉴"
    >
      <Link href={accountRoutes.home} className="grid gap-1 px-3 pt-1 pb-4">
        <span className="text-headline">{family.data?.name ?? "우리 집"}</span>
        <small className="text-caption text-muted-foreground">
          {memberNames}
        </small>
      </Link>
      <NavigationLinkList pathname={pathname} />
      <div className="mt-auto p-3 text-[length:var(--type-caption-size)] whitespace-nowrap text-muted-foreground">
        {account.data?.profile?.displayName}
        {account.data?.membership && (
          <>
            {" "}
            <FamilyRoleIcon role={account.data.membership.role} />
          </>
        )}
      </div>
    </nav>
  );
}
