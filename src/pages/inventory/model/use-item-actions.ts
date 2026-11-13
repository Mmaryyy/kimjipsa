"use client";
import {
  useInventoryActions,
  type InventoryItem,
} from "@/entities/inventory-item";
import { objectParticle } from "@/shared/lib";
import { useConfirm } from "@/shared/ui";

export function useItemActions({
  onClose,
  onNotify,
  onUsedUp,
}: {
  onClose: () => void;
  onNotify: (message: string) => void;
  onUsedUp?: (item: InventoryItem) => void;
}) {
  const actions = useInventoryActions();
  const confirm = useConfirm();
  const remove = (item: InventoryItem) =>
    confirm({
      targetName: item.name,
      title: "품목을 삭제할까요?",
      description: "삭제한 품목은 되돌릴 수 없어요.",
      onConfirm: async () => {
        await actions.save.mutateAsync({ action: "delete", id: item.id });
        onNotify("품목을 삭제했어요.");
        onClose();
      },
    });
  const usedUp = async (item: InventoryItem) => {
    await actions.onChange({ action: "used-up", id: item.id });
    if (onUsedUp) onUsedUp(item);
    else {
      onNotify("다 쓴 품목으로 바꿨어요.");
      onClose();
    }
  };
  const confirmUsedUp = (item: InventoryItem) =>
    confirm({
      title: `‘${item.name}’${objectParticle(item.name)} 다 쓰셨나요?`,
      description: "",
      confirmLabel: "다 썼어요",
      destructive: false,
      onConfirm: () => usedUp(item),
    });
  return { actions, remove, usedUp, confirmUsedUp };
}
