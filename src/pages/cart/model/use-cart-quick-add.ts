import { useCallback, useRef, useState } from "react";
import {
  cartInputSchema,
  parseCartQuickInput,
  type CartInput,
} from "@/entities/cart-item";
import {
  useInventoryActions,
  type useInventoryMeta,
} from "@/entities/inventory-item";
import { useConfirm } from "@/shared/ui";
import { useCartAdd } from "@/features/cart-add";

export function useCartQuickAdd(
  meta: ReturnType<typeof useInventoryMeta>,
  pending: boolean,
  onMessage: (message: string) => void,
) {
  const inventoryActions = useInventoryActions();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const onAdded = useCallback(
    (message: string) => {
      setName("");
      onMessage(message);
    },
    [onMessage],
  );
  const add = useCartAdd(onAdded, true);
  const choosing = useRef(false);
  const onQuickAdd = useCallback(async () => {
    if (pending || add.pending || choosing.current) return;
    choosing.current = true;
    try {
      const { unknownUnit: unitName, ...parsed } = parseCartQuickInput(
        name,
        meta.data?.units ?? [],
      );
      const item: CartInput = {
        ...parsed,
        category_id:
          meta.data?.categories.find((entry) => entry.name === "기타")?.id ??
          null,
        memo: "",
        link_url: "",
        inventory_item_id: null,
      };
      const validation = cartInputSchema.safeParse(item);
      if (!validation.success) {
        onMessage(
          validation.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
        );
        return;
      }
      const disabledUnit = meta.data?.units.find(
        (unit) => unit.id === item.unit_id && !unit.enabled,
      );
      if (!unitName && !disabledUnit) {
        await add.onAdd(item);
        return;
      }
      const unknownUnit = { item, name: unitName ?? disabledUnit!.name };
      let resolved = false;
      let unitId = item.unit_id;
      await confirm({
        disabled: () => !navigator.onLine,
        title: `'${unknownUnit.name}' 단위를 추가할까요?`,
        description: "추가하지 않으면 기본 단위 ‘개’로 담아요.",
        confirmLabel: "단위 추가",
        cancelLabel: "취소",
        destructive: false,
        secondaryAction: {
          label: "개로 담기",
          onClick: () => {
            resolved = true;
          },
        },
        onConfirm: async () => {
          const current = await meta.refetch();
          if (!current.data || current.isError)
            throw new Error("단위를 불러오지 못했어요. 다시 시도해 주세요.");
          let unit = current.data.units.find(
            (entry) =>
              entry.name.toLowerCase() === unknownUnit.name.toLowerCase(),
          );
          if (!unit) {
            await inventoryActions.meta.mutateAsync({
              action: "save",
              kind: "units",
              entry: {
                name: unknownUnit.name,
                enabled: true,
                sort_order: current.data.units.length,
                icon_kind: null,
                icon_value: "",
              },
            });
            const refreshed = await meta.refetch();
            unit = refreshed.data?.units.find(
              (entry) =>
                entry.name.toLowerCase() === unknownUnit.name.toLowerCase(),
            );
            if (refreshed.isError || !unit)
              throw new Error("단위를 확인하지 못했어요. 다시 시도해 주세요.");
          }
          if (!unit.enabled) {
            await inventoryActions.meta.mutateAsync({
              action: "save",
              kind: "units",
              id: unit.id,
              entry: { ...unit, enabled: true },
            });
          }
          unitId = unit.id;
          resolved = true;
        },
      });
      if (resolved) await add.onAdd({ ...item, unit_id: unitId });
    } finally {
      choosing.current = false;
    }
  }, [name, meta, add, onMessage, pending, inventoryActions.meta, confirm]);

  return {
    name,
    onNameChange: setName,
    add,
    onQuickAdd,
  };
}
