import type { UseFormReturn } from "react-hook-form";
import type { RestockEntry, CartItem } from "@/entities/cart-item";
import type { InventoryItem, InventoryMeta } from "@/entities/inventory-item";
import { DateTimeInput } from "@/shared/ui/date-time-input";
import {
  FormField,
  type FieldRenderProps,
  QuantityStepper,
  StatusBadge,
  TextButton,
} from "@/shared/ui";
export type RestockFormValues = { entries: RestockEntry[] };
const Field = FormField<RestockFormValues>;
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
        <div
          data-slot="field-row"
          className="flex min-h-[var(--row-min)] items-center gap-3 py-1"
        >
          <span className="basis-22 shrink-0 text-muted-foreground">상태</span>
          <span className="ml-auto text-body-sm text-muted-foreground">
            충분으로 바꿔요
          </span>
        </div>
      ) : (
        <Field
          name={`entries.${index}.quantity`}
          label="더할 수량"
          render={(
            field: FieldRenderProps<
              RestockFormValues,
              `entries.${number}.quantity`
            >,
          ) => (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <QuantityStepper
                label={item.name}
                value={field.value ?? 1}
                min={0}
                allowDirectInput
                onValueChange={field.onChange}
                controlProps={field}
              />
              {grouped ? (
                <span className="text-body-sm">
                  {meta.units.find((unit) => unit.id === leader?.unit_id)
                    ?.name ?? "단위 선택 전"}
                </span>
              ) : (
                <Field
                  name={`entries.${index}.unit_id`}
                  label={`${item.name} 단위`}
                  showLabel={false}
                  className="contents [&>div]:flex-none"
                  type="select"
                  disabled={!!existing?.unit_id || disabled}
                  options={[
                    { value: "", label: "단위" },
                    ...meta.units.map((unit) => ({
                      value: unit.id,
                      label: unit.name,
                    })),
                  ]}
                  inputProps={{
                    className: "max-w-16",
                    "aria-label": `${item.name} 단위`,
                  }}
                />
              )}
            </div>
          )}
        />
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
            <Field
              key={row.key}
              name={`entries.${index}.${row.key}`}
              label={row.label}
              type="select"
              options={[
                { value: "", label: "선택" },
                ...row.entries.map((option) => ({
                  value: option.id,
                  label: option.name,
                })),
              ]}
              disabled={row.locked || disabled}
            />
          ))}
      {!grouped && (
        <Field
          name={`entries.${index}.expires_on`}
          label="유통기한"
          disabled={disabled}
          render={(
            field: FieldRenderProps<
              RestockFormValues,
              `entries.${number}.expires_on`
            >,
          ) => (
            <DateTimeInput
              controlProps={field}
              label={`${item.name} 유통기한`}
              dateOnly
              singleDate
              range={{
                startDate: expiry,
                endDate: expiry,
                startTime: "",
                endTime: "",
              }}
              onConfirm={(range) => field.onChange(range.startDate || null)}
            />
          )}
        />
      )}
      {!grouped && expiry && (
        <TextButton
          aria-label={`${item.name} 유통기한 지우기`}
          onClick={() =>
            form.setValue(`entries.${index}.expires_on`, null, {
              shouldDirty: true,
            })
          }
        >
          유통기한 지우기
        </TextButton>
      )}
    </fieldset>
  );
};
export default RestockItem;
