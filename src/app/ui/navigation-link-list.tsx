import Link from "next/link";
import { useChatNavigation } from "@/features/chat-navigation";
import { appNavigation, appNavigationWithBot } from "../config";
import { isCurrentPath } from "@/shared/lib";
import { cartRoutes, chatPath } from "@/shared/config";
export function NavigationLinkList({ pathname }: { pathname: string }) {
  const { minimized, ready, onOpen } = useChatNavigation();
  const navigation = ready && minimized ? appNavigationWithBot : appNavigation;
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
              className="kj-hit"
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
