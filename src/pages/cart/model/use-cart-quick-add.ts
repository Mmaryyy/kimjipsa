import { useCallback, useState } from "react";
import {
  cartInputSchema,
  parseCartQuickInput,
  type CartInput,
} from "@/entities/cart-item";
import {
  useInventoryActions,
  type useInventoryMeta,
} from "@/entities/inventory-item";
import { useCartAdd } from "@/features/cart-add";

export function useCartQuickAdd(
  meta: ReturnType<typeof useInventoryMeta>,
  pending: boolean,
  onMessage: (message: string) => void,
) {
  const inventoryActions = useInventoryActions();
  const [unknownUnit, setUnknownUnit] = useState<{
    item: CartInput;
    name: string;
  } | null>(null);
  const [unitError, setUnitError] = useState("");
  const [resolvingUnit, setResolvingUnit] = useState(false);
  const [name, setName] = useState("");
  const onAdded = useCallback(
    (message: string) => {
      setName("");
      onMessage(message);
    },
    [onMessage],
  );
  const add = useCartAdd(onAdded, true);
  const onQuickAdd = useCallback(() => {
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
    if (unitName || disabledUnit) {
      setUnitError("");
      setUnknownUnit({ item, name: unitName ?? disabledUnit!.name });
    } else void add.onAdd(item);
  }, [name, meta.data, add, onMessage]);
  const onResolveUnit = useCallback(
    async (create: boolean) => {
      if (!unknownUnit || pending || resolvingUnit) return;
      setResolvingUnit(true);
      setUnitError("");
      try {
        let unitId = unknownUnit.item.unit_id;
        if (create) {
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
        }
        setUnknownUnit(null);
        await add.onAdd({ ...unknownUnit.item, unit_id: unitId });
      } catch (error) {
        setUnitError(
          error instanceof Error ? error.message : "단위를 추가하지 못했어요.",
        );
      } finally {
        setResolvingUnit(false);
      }
    },
    [unknownUnit, pending, resolvingUnit, meta, inventoryActions.meta, add],
  );

  const onUnitOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !resolvingUnit) setUnknownUnit(null);
    },
    [resolvingUnit],
  );
  return {
    name,
    onNameChange: setName,
    add,
    unknownUnit,
    unitError,
    resolvingUnit,
    onQuickAdd,
    onResolveUnit,
    onUnitOpenChange,
  };
}
