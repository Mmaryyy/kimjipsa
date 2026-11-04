"use client";

import { Badge } from "@/shared/ui";
import { FamilyRoleIcon, roles } from "@/entities/family";

import Link from "next/link";
import { NavigationLinkList } from "./navigation-link-list";
import { UserIcon } from "lucide-react";
import { accountRoutes } from "@/shared/config";
import { cn } from "@/shared/lib";
import { useAccount } from "@/features/account";
import { useFamily } from "@/features/family";

export function SidebarNavigation({ pathname }: { pathname: string }) {
  const account = useAccount();
  const family = useFamily();
  const memberNames = family.data?.members
    .filter((member) => member.user_id !== account.data?.userId)
    .map((member) => member.display_name)
    .join(" · ");
  return (
    <nav
      className={cn([
        "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-62 lg:flex-col lg:gap-6 lg:bg-card",
        "lg:px-3 lg:py-5 lg:[&_li_a]:flex lg:[&_li_a]:min-h-8 lg:[&_li_a]:items-center",
        "lg:[&_li_a]:gap-2 lg:[&_li_a]:rounded-sm lg:[&_li_a]:px-3 lg:[&_li_a]:whitespace-nowrap",
        "lg:[&_li_a]:text-foreground",
        "lg:[&_li_a:not([aria-current=page])_svg]:text-[var(--icon-secondary)]",
        "lg:[&_li_a[aria-current=page]_svg]:text-primary lg:[&_li_a[aria-current=page]]:bg-muted",
      ])}
      aria-label="주 메뉴"
    >
      <div className="flex flex-col gap-1">
        <Link href={accountRoutes.home} className="grid gap-1 px-3 pt-1">
          <span className="text-headline font-bold tracking-widest">
            KIMJIPSA
          </span>
          <span className="text-headline">
            {family.data?.name ?? "우리 집"}
          </span>
          {memberNames && (
            <small className="text-caption text-muted-foreground">
              {memberNames} 님과 함께
            </small>
          )}
        </Link>
        <div
          className={cn(
            "flex flex-row items-start gap-2 p-3 whitespace-nowrap",
            "text-[length:var(--type-caption-size)] text-muted-foreground",
          )}
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center",
              "overflow-hidden rounded-full bg-secondary",
            )}
          >
            <UserIcon className="size-5" />
          </div>
          <div className="flex flex-col gap-1 justify-start">
            <span className="font-semibold">
              {account.data?.profile?.displayName}
            </span>
            {account.data?.membership && (
              <Badge>
                {roles[account.data.membership.role]}
                <FamilyRoleIcon role={account.data.membership.role} />
              </Badge>
            )}
          </div>
        </div>
      </div>
      <NavigationLinkList pathname={pathname} />
    </nav>
  );
}
