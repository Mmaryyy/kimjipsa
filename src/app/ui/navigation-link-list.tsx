import { sidebarNavigation, sidebarNavigationWithBot } from "../config";
import { cartRoutes, chatPath } from "@/shared/config";
import { cn, isCurrentPath } from "@/shared/lib";

import Link from "next/link";
import { useChatNavigation } from "@/features/chat-navigation";

export function NavigationLinkList({ pathname }: { pathname: string }) {
  const { minimized, ready, onOpen } = useChatNavigation();
  const navigation =
    ready && minimized ? sidebarNavigationWithBot : sidebarNavigation;
  return (
    <ul>
      {navigation.map(({ href, label, icon: Icon }) => {
        const active =
          isCurrentPath(pathname, href) ||
          (href === cartRoutes.cart &&
            isCurrentPath(pathname, cartRoutes.restock));
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={
                href === chatPath
                  ? (event) => {
                      event.preventDefault();
                      onOpen();
                    }
                  : undefined
              }
              data-od-id={href === chatPath ? "tab-bot" : undefined}
              className={cn([
                "kj-hit",
                "aria-[current=page]:text-[var(--link)]",
              ])}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
