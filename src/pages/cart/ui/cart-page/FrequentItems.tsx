import Link from "next/link";
import { cartRoutes } from "@/shared/config";
import { markHistoryBack } from "@/shared/lib";
import { Plus } from "lucide-react";
import { type CartInput } from "@/entities/cart-item";
import { GroupLabel, TextButton } from "@/shared/ui";
interface Props {
  frequent: CartInput[];
  disabled: boolean;
  onAdd: (item: CartInput) => Promise<boolean>;
}
const CartFrequentItems = ({ frequent, disabled, onAdd }: Props) => (
  <section data-od-id="cart-frequent" className="mt-4">
    <div className="flex items-center justify-between">
      <GroupLabel as="h2" className="pt-0">
        자주 사는 품목
      </GroupLabel>
      <Link
        href={`${cartRoutes.frequentItems}?from=cart`}
        onNavigate={() => markHistoryBack(cartRoutes.frequentItems)}
        className="kj-hit text-caption text-primary"
      >
        관리
      </Link>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 pb-2.5">
      {frequent.map((item, index) => (
        <TextButton
          key={item.name}
          size="sm"
          data-od-id={`freq-${index}`}
          disabled={disabled}
          onClick={() => void onAdd({ ...item, quantity: 1 })}
        >
          <Plus size={14} aria-hidden />
          {item.name}
        </TextButton>
      ))}
    </div>
  </section>
);
export default CartFrequentItems;
