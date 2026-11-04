import { chatPath } from "@/shared/config";
import {
  Bot,
  CalendarDays,
  House,
  Package,
  Settings,
  ShoppingBasket,
} from "lucide-react";

export const appNavigation = [
  { href: "/", label: "오늘", icon: House },
  { href: "/calendar", label: "일정", icon: CalendarDays },
  { href: "/inventory", label: "재고", icon: Package },
  { href: "/cart", label: "장바구니", icon: ShoppingBasket },
  { href: "/settings", label: "설정", icon: Settings },
] as const;

export const appNavigationWithBot = [
  ...appNavigation.slice(0, 4),
  { href: chatPath, label: "집사", icon: Bot },
  ...appNavigation.slice(4),
];
