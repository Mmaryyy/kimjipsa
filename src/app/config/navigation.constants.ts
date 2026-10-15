import {
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
