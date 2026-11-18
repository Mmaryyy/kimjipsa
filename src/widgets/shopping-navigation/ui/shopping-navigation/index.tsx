import { cartRoutes, inventoryRoutes } from "@/shared/config";
import { SegmentedNavigation } from "@/shared/ui";

const links = [
  { href: cartRoutes.cart, label: "장바구니" },
  { href: inventoryRoutes.inventory, label: "재고" },
] as const;

interface Props {
  current: (typeof links)[number]["href"];
}

const ShoppingNavigation = ({ current }: Props) => (
  <SegmentedNavigation
    label="장보기"
    links={links}
    current={current}
    odId={
      current === cartRoutes.cart
        ? "prj-shopping-segments"
        : "prj-inventory-segments"
    }
    className="mb-3"
  />
);

export default ShoppingNavigation;
