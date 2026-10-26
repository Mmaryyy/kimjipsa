import {
  Carrot,
  Beef,
  Milk,
  Pizza,
  CupSoda,
  FlaskRound,
  SoapDispenserDroplet,
  HeartPulse,
  Tag,
} from "lucide-react";
import type { InventoryMetaEntry } from "../../api/type";
const icons = {
  carrot: Carrot,
  beef: Beef,
  milk: Milk,
  pizza: Pizza,
  "cup-soda": CupSoda,
  "flask-round": FlaskRound,
  "soap-dispenser-droplet": SoapDispenserDroplet,
  "heart-pulse": HeartPulse,
  tag: Tag,
};
interface Props {
  category: Pick<InventoryMetaEntry, "name" | "icon_kind" | "icon_value">;
}
const InventoryCategoryIcon = ({ category }: Props) => {
  const Icon =
    category.icon_kind === "lucide" && Object.hasOwn(icons, category.icon_value)
      ? icons[category.icon_value as keyof typeof icons]
      : null;
  if (Icon)
    return (
      <Icon
        aria-hidden
        className="size-4 shrink-0 text-[var(--icon-secondary)]"
      />
    );
  const text =
    category.icon_kind === "text" && category.icon_value
      ? category.icon_value
      : [
          ...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(
            category.name,
          ),
        ][0]?.segment;
  return (
    <span
      aria-hidden
      className="inline-flex size-4 shrink-0 items-center justify-center"
    >
      {text}
    </span>
  );
};
export default InventoryCategoryIcon;
