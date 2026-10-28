import type { UseFormReturn } from "react-hook-form";
import type { RestockEntry, CartItem } from "@/entities/cart-item";
import type { InventoryItem, InventoryMeta } from "@/entities/inventory-item";
import { DateTimeInput } from "@/shared/ui/date-time-input";
import { FormFieldRow, QuantityStepper, StatusBadge } from "@/shared/ui";
export type RestockFormValues = { entries: RestockEntry[] };
interface Props {
  item: CartItem;
  existing?: InventoryItem;
  leaderIndex?: number;
  index: number;
  meta: InventoryMeta;
  form: UseFormReturn<RestockFormValues>;
  disabled: boolean;
}
const RestockItem = ({
  item,
  existing,
  leaderIndex,
  index,
  meta,
  form,
  disabled,
}: Props) => {
  const entry = form.watch(`entries.${index}`);
  const leader = form.watch(`entries.${leaderIndex ?? index}`);
  const grouped = leaderIndex !== undefined;
  const expiry = entry?.expires_on ?? "";
  const statusOnly = existing?.mode === "status";
  const currentUnit =
    meta.units.find((unit) => unit.id === existing?.unit_id)?.name ?? "";
  const stockLabel = statusOnly
    ? "상태 품목"
    : `${existing?.quantity ?? 0}${currentUnit}`;
  const purchaseUnit =
    meta.units.find((unit) => unit.id === item.unit_id)?.name ?? "";
  const errors = form.formState.errors.entries?.[index];
  const selectRows = [
    {
      key: "unit_id",
      label: "단위",
      entries: meta.units,
      hide: true,
      locked: !!existing?.unit_id,
    },
    {
      key: "category_id",
      label: "카테고리",
      entries: meta.categories,
      hide: !!existing?.category_id,
      locked: !!existing?.category_id,
    },
    {
      key: "location_id",
      label: "보관 장소",
      entries: meta.locations.filter(
        (location) => location.enabled || location.id === existing?.location_id,
      ),
      hide: false,
      locked: false,
    },
  ] as const;
  return (
    <fieldset
      disabled={disabled}
      data-od-id={`restock-item-${index}`}
      className="mt-3 min-w-0 pb-2 [&_[data-slot=field-row]>label]:text-muted-foreground"
    >
      <div className="flex flex-wrap items-baseline gap-2 pt-3">
        <h2 className="text-headline">{item.name}</h2>
        <span className="text-body-sm text-muted-foreground">
          {item.quantity}
          {purchaseUnit} 구매
        </span>
        <StatusBadge
          variant={existing ? "info" : "success"}
          className="ml-auto"
        >
          {existing
            ? "기존 재고에 더함"
            : grouped
              ? "위 새 품목에 더함"
              : "새 품목"}
        </StatusBadge>
      </div>
      {existing && (
        <p className="mt-0.5 text-caption text-muted-foreground">
          지금 {stockLabel} ·{" "}
          {meta.locations.find(
            (location) => location.id === existing.location_id,
          )?.name ?? "보관 장소 없음"}
        </p>
      )}
      {statusOnly ? (
        <FormFieldRow label="상태" htmlFor={`restock-status-${index}`}>
          {() => (
            <span
              id={`restock-status-${index}`}
              className="text-body-sm text-muted-foreground"
            >
              충분으로 바꿔요
            </span>
          )}
        </FormFieldRow>
      ) : (
        <FormFieldRow
          label="더할 수량"
          htmlFor={`restock-quantity-${index}`}
          invalid={!!errors?.quantity}
          error="수량은 0보다 커야 해요."
        >
          {() => (
            <div className="flex items-center justify-end gap-2">
              <QuantityStepper
                label={item.name}
                value={entry?.quantity ?? 1}
                min={0}
                allowDirectInput
                onValueChange={(value) =>
                  form.setValue(`entries.${index}.quantity`, value, {
                    shouldDirty: true,
                  })
                }
              />
              {grouped ? (
                <span className="text-body-sm">
                  {meta.units.find((unit) => unit.id === leader?.unit_id)
                    ?.name ?? "단위 선택 전"}
                </span>
              ) : (
                <select
                  aria-label={`${item.name} 단위`}
                  {...form.register(`entries.${index}.unit_id`)}
                  disabled={!!existing?.unit_id || disabled}
                  className="max-w-16"
                >
                  <option value="">단위</option>
                  {meta.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </FormFieldRow>
      )}
      {existing?.unit_id && existing.unit_id !== item.unit_id && (
        <p className="text-caption text-muted-foreground">
          기존 재고 단위({currentUnit})로 더할 수량을 확인해 주세요.
        </p>
      )}
      {!grouped &&
        selectRows
          .filter((row) => !row.hide)
          .map((row) => (
            <FormFieldRow
              key={row.key}
              label={row.label}
              htmlFor={`restock-${row.key}-${index}`}
              invalid={!!errors?.[row.key]}
              error={`${row.label}를 선택해 주세요.`}
            >
              {(props) => (
                <select
                  {...props}
                  {...form.register(`entries.${index}.${row.key}`)}
                  disabled={row.locked || disabled}
                >
                  <option value="">선택</option>
                  {row.entries.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              )}
            </FormFieldRow>
          ))}
      {!grouped && (
        <FormFieldRow label="유통기한" htmlFor={`restock-expiry-${index}`}>
          {(props) => (
            <DateTimeInput
              controlProps={props}
              label={`${item.name} 유통기한`}
              dateOnly
              singleDate
              range={{
                startDate: expiry,
                endDate: expiry,
                startTime: "",
                endTime: "",
              }}
              dateInputProps={{
                value: expiry,
                onChange: (event) =>
                  form.setValue(
                    `entries.${index}.expires_on`,
                    event.target.value || null,
                  ),
              }}
              onConfirm={(range) =>
                form.setValue(
                  `entries.${index}.expires_on`,
                  range.startDate || null,
                )
              }
            />
          )}
        </FormFieldRow>
      )}
    </fieldset>
  );
};
export default RestockItem;
