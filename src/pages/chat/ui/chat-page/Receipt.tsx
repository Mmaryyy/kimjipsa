"use client";
import { useState } from "react";
import {
  type Receipt,
  type ReceiptItem,
  useChatActions,
} from "@/entities/chat-message";
import { useInventory, useInventoryMeta } from "@/entities/inventory-item";
import { compareItemNames } from "@/shared/lib";
import { Button, Input, Text } from "@/shared/ui";
interface Props {
  receipt: Receipt;
  now: number;
}
const ReceiptCard = ({ receipt, now }: Props) => {
  const [items, setItems] = useState(receipt.items);
  const { data: inventory = [] } = useInventory();
  const { data: meta } = useInventoryMeta();
  const { receipt: mutation } = useChatActions();
  const expired = Date.parse(receipt.expires_at) <= now;
  const editable = receipt.status === "draft" && !expired;
  const update = (index: number, patch: Partial<ReceiptItem>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  if (!editable)
    return (
      <Text as="p" variant="caption">
        {receipt.status === "applied"
          ? "재고에 반영했어요."
          : receipt.status === "cancelled"
            ? "취소했어요."
            : "확인 기간이 끝났어요."}
      </Text>
    );
  return (
    <section
      aria-label={receipt.kind === "receipt" ? "영수증 확인" : "변경 제안 확인"}
      className="space-y-4 py-4"
    >
      <Text as="h3" variant="headline">
        {receipt.kind === "receipt" ? "영수증 품목 확인" : "재고 변경 확인"}
      </Text>
      {items.map((item, index) => {
        const candidates = inventory.filter(
          (candidate) =>
            compareItemNames(candidate.name, item.name) !== "different",
        );
        const options = [
          ...candidates,
          ...inventory.filter((candidate) => !candidates.includes(candidate)),
        ];
        return (
          <fieldset
            key={index}
            disabled={mutation.isPending}
            className="min-w-0 space-y-2"
          >
            <legend className="text-label">품목 {index + 1}</legend>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) =>
                  update(index, { selected: event.target.checked })
                }
              />
              반영하기
            </label>
            <Input
              aria-label={`품목 ${index + 1} 이름`}
              value={item.name}
              onChange={(event) => update(index, { name: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label={`품목 ${index + 1} 수량`}
                type="number"
                min="0.001"
                step="any"
                value={item.quantity}
                onChange={(event) =>
                  update(index, { quantity: event.target.valueAsNumber })
                }
              />
              <select
                className="min-w-0 bg-muted p-2"
                aria-label={`품목 ${index + 1} 단위`}
                value={item.unit_id ?? ""}
                onChange={(event) =>
                  update(index, {
                    unit_id: event.target.value || null,
                    inventory_item_id: null,
                  })
                }
              >
                <option value="">단위 선택</option>
                {meta?.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              className="w-full bg-muted p-2"
              aria-label={`품목 ${index + 1} 기존 재고 연결`}
              value={item.inventory_item_id ?? ""}
              onChange={(event) => {
                const linked = inventory.find(
                  (candidate) => candidate.id === event.target.value,
                );
                update(index, {
                  inventory_item_id: linked?.id ?? null,
                  ...(linked ? { unit_id: linked.unit_id } : {}),
                });
              }}
            >
              <option value="">새 품목으로 등록</option>
              {options
                .filter((candidate) => candidate.mode === "quantity")
                .map((candidate) => (
                  <option value={candidate.id} key={candidate.id}>
                    {candidate.name}
                    {candidates.includes(candidate) ? " · 이름이 비슷해요" : ""}
                  </option>
                ))}
            </select>
            {!item.inventory_item_id && (
              <>
                <select
                  className="w-full bg-muted p-2"
                  aria-label={`품목 ${index + 1} 카테고리`}
                  value={item.category_id ?? ""}
                  onChange={(event) =>
                    update(index, { category_id: event.target.value || null })
                  }
                >
                  <option value="">카테고리 없음</option>
                  {meta?.categories.map((entry) => (
                    <option value={entry.id} key={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full bg-muted p-2"
                  aria-label={`품목 ${index + 1} 보관 장소`}
                  value={item.location_id ?? ""}
                  onChange={(event) =>
                    update(index, { location_id: event.target.value || null })
                  }
                >
                  <option value="">보관 장소 없음</option>
                  {meta?.locations
                    .filter((entry) => entry.enabled)
                    .map((entry) => (
                      <option value={entry.id} key={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                </select>
                <Input
                  type="date"
                  aria-label={`품목 ${index + 1} 유통기한`}
                  value={item.expires_on ?? ""}
                  onChange={(event) =>
                    update(index, { expires_on: event.target.value || null })
                  }
                />
              </>
            )}
            {item.reason && (
              <Text as="p" variant="caption">
                {item.reason}
              </Text>
            )}
          </fieldset>
        );
      })}
      <div className="flex gap-2">
        <Button
          disabled={
            mutation.isPending ||
            !items.some((item) => item.selected) ||
            items.some(
              (item) =>
                item.selected &&
                (!item.unit_id ||
                  !item.name.trim() ||
                  !Number.isFinite(item.quantity) ||
                  item.quantity <= 0),
            )
          }
          onClick={() =>
            mutation.mutate({ id: receipt.id, version: receipt.version, items })
          }
        >
          재고에 반영하기
        </Button>
        <Button
          variant="gray"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              id: receipt.id,
              version: receipt.version,
              cancel: true,
            })
          }
        >
          취소하기
        </Button>
      </div>
      {mutation.error && (
        <Text as="p" role="alert" className="text-error-text">
          {mutation.error.message}
        </Text>
      )}
    </section>
  );
};
export default ReceiptCard;
