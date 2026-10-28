import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TextButton } from "@/shared/ui";
interface Props {
  id: string;
  name: string;
  index: number;
  disabled: boolean;
}
const CornerOrderRow = ({ id, name, index, disabled }: Props) => {
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    attributes,
    listeners,
  } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
      data-od-id={`order-${index}`}
    >
      <TextButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="w-full touch-none justify-between text-foreground"
        aria-label={`${name} 순서 바꾸기`}
      >
        {name}
        <GripVertical
          aria-hidden
          className="size-4 text-[var(--icon-tertiary)]"
        />
      </TextButton>
    </li>
  );
};
export default CornerOrderRow;
