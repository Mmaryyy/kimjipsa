import Link from "next/link";
import { appNavigation } from "../config";
import { isCurrentPath } from "@/shared/lib";
export function NavigationLinkList({ pathname }: { pathname: string }) {
  return (
    <ul>
      {appNavigation.map(({ href, label, icon: Icon }) => {
        const active = isCurrentPath(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
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
