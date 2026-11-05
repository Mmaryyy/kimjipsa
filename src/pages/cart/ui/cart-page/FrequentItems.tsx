import { Plus } from "lucide-react";
import { withFrequentCartDefaults, type CartInput } from "@/entities/cart-item";
import { GroupLabel, TextButton } from "@/shared/ui";
interface Props {
  frequent: CartInput[];
  units: readonly { id: string; name: string }[];
  categories: readonly { id: string; name: string }[];
  disabled: boolean;
  onAdd: (item: CartInput) => Promise<boolean>;
}
const CartFrequentItems = ({
  frequent,
  units,
  categories,
  disabled,
  onAdd,
}: Props) => (
  <section data-od-id="cart-frequent" className="mt-4">
    <GroupLabel as="h2" className="pt-0">
      자주 사는 품목
    </GroupLabel>
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 pb-2.5">
      {withFrequentCartDefaults(frequent, units, categories).map(
        (item, index) => (
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
        ),
      )}
    </div>
  </section>
);
export default CartFrequentItems;
