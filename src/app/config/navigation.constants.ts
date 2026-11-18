import { cartRoutes, chatPath, inventoryRoutes } from "@/shared/config";
import {
  Bot,
  Briefcase,
  CalendarDays,
  House,
  Package,
  Settings,
  ShoppingBasket,
  ShoppingCart,
} from "lucide-react";

const home = { href: "/", label: "오늘", icon: House } as const;
const calendar = {
  href: "/calendar",
  label: "일정",
  icon: CalendarDays,
} as const;
const projects = {
  href: "/projects",
  label: "프로젝트",
  icon: Briefcase,
} as const;
const settings = { href: "/settings", label: "설정", icon: Settings } as const;
const bot = { href: chatPath, label: "집사", icon: Bot } as const;

export const bottomNavigation = [
  home,
  calendar,
  { href: cartRoutes.cart, label: "장보기", icon: ShoppingCart },
  projects,
  settings,
] as const;

export const sidebarNavigation = [
  home,
  calendar,
  { href: cartRoutes.cart, label: "장바구니", icon: ShoppingBasket },
  { href: inventoryRoutes.inventory, label: "재고", icon: Package },
  projects,
  settings,
] as const;

export const bottomNavigationWithBot = [
  ...bottomNavigation.slice(0, -1),
  bot,
  settings,
];

export const sidebarNavigationWithBot = [
  ...sidebarNavigation.slice(0, -1),
  bot,
  settings,
];
