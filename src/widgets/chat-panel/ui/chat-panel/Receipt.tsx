"use client";

import { BotMessageSquare, CircleAlert } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import {
  type Receipt,
  type ReceiptItem,
  useChatActions,
} from "@/entities/chat-message";
import { useInventory, useInventoryMeta } from "@/entities/inventory-item";
import { compareItemNames } from "@/shared/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AiGradientIcon,
  Banner,
  Button,
  Checkbox,
  FormFieldRow,
  Input,
  List,
  ListRow,
  Message,
  MessageContent,
  Select,
  StatusBadge,
  Text,
} from "@/shared/ui";
import { DateTimeInput } from "@/shared/ui/date-time-input";
import ChatAvatar from "./Avatar";

const requiredFields = [
  { key: "name", error: "이름 필요", description: "이름이 빠진 품목" },
  { key: "unit", error: "단위 필요", description: "단위가 빠진 품목" },
  {
    key: "quantity",
    error: "수량 확인 필요",
    description: "수량이 올바르지 않은 품목",
  },
] as const;

const missingFields = (item: ReceiptItem) => ({
  name: !item.name.trim(),
  unit: !item.unit_id,
  quantity: !Number.isFinite(item.quantity) || item.quantity <= 0,
});

type Inventory = NonNullable<ReturnType<typeof useInventory>["data"]>;
type InventoryMeta = ReturnType<typeof useInventoryMeta>["data"];

interface ReceiptItemRowProps {
  item: ReceiptItem;
  index: number;
  inventory: Inventory;
  meta: InventoryMeta;
  disabled: boolean;
  onUpdate: (patch: Partial<ReceiptItem>) => void;
}

const ReceiptItemFields = ({
  item,
  index,
  inventory,
  meta,
  disabled,
  onUpdate,
  linked,
  applied = false,
}: ReceiptItemRowProps & { linked?: Inventory[number]; applied?: boolean }) => {
  const id = useId();
  const label = `품목 ${index + 1}`;
  const missing = missingFields(item);
  const details = linked ?? item;
  const expiry = details.expires_on ?? "";
  const isLinked = item.inventory_item_id !== null;
  const candidates = inventory.filter(
    (candidate) => compareItemNames(candidate.name, item.name) !== "different",
  );
  const options = [
    ...candidates,
    ...inventory.filter((candidate) => !candidates.includes(candidate)),
  ];

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-2 text-caption">
      {applied ? (
        <legend className="text-label">{label}</legend>
      ) : (
        <legend className="sr-only">{label} 수정</legend>
      )}
      {applied && (
        <div className="flex items-center gap-2">
          <Checkbox id={`${id}-selected`} checked={item.selected} disabled />
          <label htmlFor={`${id}-selected`}>반영하기</label>
        </div>
      )}
      <FormFieldRow
        layout="inline"
        density="compact"
        label="이름"
        htmlFor={`${id}-name`}
        invalid={item.selected && missing.name}
        error={requiredFields[0].error}
      >
        {(control) => (
          <Input
            variant="compact"
            {...control}
            aria-label={`${label} 이름`}
            value={item.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
          />
        )}
      </FormFieldRow>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start gap-2">
        <FormFieldRow
          layout="inline"
          density="compact"
          label="수량"
          htmlFor={`${id}-quantity`}
          invalid={item.selected && missing.quantity}
          error={requiredFields[2].error}
        >
          {(control) => (
            <Input
              variant="compact"
              {...control}
              aria-label={`${label} 수량`}
              type="number"
              min="0.001"
              step="any"
              value={Number.isFinite(item.quantity) ? item.quantity : ""}
              onChange={(event) =>
                onUpdate({ quantity: event.target.valueAsNumber })
              }
            />
          )}
        </FormFieldRow>
        <FormFieldRow
          layout="inline"
          density="compact"
          label="단위"
          htmlFor={`${id}-unit`}
          invalid={item.selected && missing.unit}
          error={requiredFields[1].error}
        >
          {(control) => (
            <Select
              variant="compact"
              {...control}
              aria-label={`${label} 단위`}
              value={item.unit_id ?? ""}
              onChange={(event) =>
                onUpdate({
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
            </Select>
          )}
        </FormFieldRow>
      </div>
      <FormFieldRow
        layout="inline"
        density="compact"
        label="유통기한"
        htmlFor={`${id}-expiry`}
      >
        {(control) => (
          <DateTimeInput
            variant="field"
            size="compact"
            label={`${label} 유통기한`}
            controlProps={{ ...control, disabled: disabled || isLinked }}
            dateOnly
            singleDate
            range={{
              startDate: expiry,
              endDate: expiry,
              startTime: "",
              endTime: "",
            }}
            onConfirm={(range) => onUpdate({ expires_on: range.startDate })}
            onClear={
              expiry && !isLinked
                ? () => onUpdate({ expires_on: null })
                : undefined
            }
          />
        )}
      </FormFieldRow>
      <div className="grid grid-cols-2 gap-2">
        <Select
          variant="compact"
          aria-label={`${label} 카테고리`}
          disabled={isLinked}
          value={details.category_id ?? ""}
          onChange={(event) =>
            onUpdate({ category_id: event.target.value || null })
          }
        >
          <option value="">카테고리</option>
          {meta?.categories.map((entry) => (
            <option value={entry.id} key={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
        <Select
          variant="compact"
          aria-label={`${label} 보관 장소`}
          disabled={isLinked}
          value={details.location_id ?? ""}
          onChange={(event) =>
            onUpdate({ location_id: event.target.value || null })
          }
        >
          <option value="">보관 장소</option>
          {meta?.locations
            .filter(
              (entry) =>
                entry.enabled || (isLinked && entry.id === details.location_id),
            )
            .map((entry) => (
              <option value={entry.id} key={entry.id}>
                {entry.name}
              </option>
            ))}
        </Select>
      </div>
      <Select
        variant="compact"
        aria-label={`${label} 기존 재고 연결`}
        value={item.inventory_item_id ?? ""}
        onChange={(event) => {
          const linked = options.find(
            (candidate) => candidate.id === event.target.value,
          );
          onUpdate({
            inventory_item_id: linked?.id ?? null,
            ...(linked ? { unit_id: linked.unit_id } : {}),
          });
        }}
      >
        <option value="">새 품목</option>
        {options
          .filter((candidate) => candidate.mode === "quantity")
          .map((candidate) => (
            <option value={candidate.id} key={candidate.id}>
              {candidate.name}
              {candidates.includes(candidate) ? " · 이름이 비슷해요" : ""}
            </option>
          ))}
      </Select>
      {applied && item.reason && (
        <Text as="p" variant="caption">
          {item.reason}
        </Text>
      )}
    </fieldset>
  );
};

const inventoryTarget = (item: ReceiptItem, linked?: Inventory[number]) => {
  if (!item.inventory_item_id) return "새 품목";
  return linked ? `기존 품목 ${linked.name}` : "기존 품목";
};

const ReceiptItemRow = ({
  kind,
  ...props
}: ReceiptItemRowProps & { kind: Receipt["kind"] }) => {
  const { item, index, inventory, meta, disabled, onUpdate } = props;
  const linked = inventory.find(
    (candidate) => candidate.id === item.inventory_item_id,
  );
  const details = linked ?? item;
  const unit = meta?.units.find((entry) => entry.id === item.unit_id)?.name;
  const category = meta?.categories.find(
    (entry) => entry.id === details.category_id,
  )?.name;
  const location = meta?.locations.find(
    (entry) => entry.id === details.location_id,
  )?.name;
  const missing = missingFields(item);
  const amount = missing.quantity
    ? unit
    : [item.quantity, unit].filter(Boolean).join(" ");
  const warning = item.selected
    ? requiredFields
        .filter(({ key }) => missing[key])
        .map(({ error }) => error)
        .join(" · ")
    : "";

  return (
    <AccordionItem asChild variant={null} value={String(index)}>
      <li>
        <ListRow
          as="div"
          size="compact"
          leading={
            <span className="mt-1 flex h-[var(--type-label-lh)] shrink-0 items-center self-start">
              <Checkbox
                aria-label={`품목 ${index + 1} ${item.name.trim()} 반영`}
                checked={item.selected}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onUpdate({ selected: checked === true })
                }
              />
            </span>
          }
        >
          <AccordionTrigger
            heading="h4"
            size="compact"
            indicator={kind === "receipt" ? "ellipsis" : "chevron"}
            disabled={disabled}
          >
            <span className="min-w-0 flex-1">
              <span className="flex h-[var(--type-label-lh)] items-baseline gap-1">
                <Text variant="label" className="min-w-0 truncate">
                  {item.name.trim() || "이름 없음"}
                </Text>{" "}
                {amount && (
                  <Text
                    variant="caption"
                    className="max-w-1/3 shrink-0 truncate"
                  >
                    · {amount}
                  </Text>
                )}{" "}
                {details.expires_on && (
                  <Text
                    variant="caption-sm"
                    tone="muted"
                    className="shrink-0 whitespace-nowrap"
                  >
                    · {details.expires_on}
                  </Text>
                )}
                {warning && (
                  <CircleAlert
                    className="size-4 shrink-0 self-center text-warning-text"
                    role="img"
                    aria-label={`확인 필요: ${warning}`}
                  />
                )}{" "}
                {!warning && item.reason && (
                  <AiGradientIcon
                    icon={BotMessageSquare}
                    className="size-4 shrink-0 self-center"
                    strokeWidth={2.25}
                    role="img"
                    aria-label={`집사 코멘트: ${item.reason}`}
                  />
                )}
              </span>{" "}
              <Text
                variant="caption-sm"
                tone="muted"
                className="flex items-center gap-1"
              >
                {(category || location) && (
                  <>
                    <span className="truncate">
                      {category}
                      {category && location && (
                        <>
                          {" "}
                          <span
                            aria-hidden="true"
                            className="text-label-tertiary"
                          >
                            |
                          </span>{" "}
                        </>
                      )}
                      {location}
                    </span>{" "}
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-label-tertiary"
                    >
                      |
                    </span>{" "}
                  </>
                )}
                <StatusBadge variant="neutral" shape="pill">
                  {inventoryTarget(item)}
                </StatusBadge>
              </Text>
            </span>
          </AccordionTrigger>
        </ListRow>
        <AccordionContent
          variant={kind === "receipt" ? "card" : undefined}
          leading={
            item.reason && (
              <div className="py-2 mb-2">
                <Message from="assistant" variant="callout">
                  <ChatAvatar size="compact" />
                  <MessageContent variant="callout">
                    {item.reason}
                  </MessageContent>
                </Message>
              </div>
            )
          }
        >
          <ReceiptItemFields {...props} linked={linked} />
        </AccordionContent>
      </li>
    </AccordionItem>
  );
};

interface ReceiptSummaryProps {
  items: ReceiptItem[];
  inventory: Inventory;
  meta: InventoryMeta;
}

const ReceiptSummary = ({ items, inventory, meta }: ReceiptSummaryProps) => (
  <List>
    {items.map((item, index) => {
      const linked = inventory.find(
        (candidate) => candidate.id === item.inventory_item_id,
      );
      const unit = meta?.units.find((entry) => entry.id === item.unit_id)?.name;
      const amount = [item.quantity, unit].filter(Boolean).join(" ");
      return (
        <ListRow key={index}>
          <Text variant="caption" className="break-keep">
            {item.name} · {amount} · {inventoryTarget(item, linked)}
          </Text>
        </ListRow>
      );
    })}
  </List>
);

interface Props {
  receipt: Receipt;
  now: number;
}

const ReceiptCard = ({ receipt, now }: Props) => {
  const [items, setItems] = useState(receipt.items);
  const [confirming, setConfirming] = useState(false);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  const { data: inventory = [] } = useInventory();
  const { data: meta } = useInventoryMeta();
  const { receipt: mutation } = useChatActions();
  const isReceipt = receipt.kind === "receipt";
  const expired = Date.parse(receipt.expires_at) <= now;
  const applied = receipt.status === "applied";
  const editable = receipt.status === "draft" && !expired;
  const selectedItems = (applied ? receipt.items : items).filter(
    (item) => item.selected,
  );
  const selectedErrors = selectedItems.map(missingFields);
  const blockers = requiredFields.flatMap(({ key, description }) => {
    const count = selectedErrors.filter((errors) => errors[key]).length;
    return count ? [`${description} ${count}개`] : [];
  });
  const canApply =
    selectedItems.length > 0 && blockers.length === 0 && !mutation.isPending;

  useLayoutEffect(() => {
    if (confirming === wasConfirming.current) return;
    wasConfirming.current = confirming;
    if (confirming) confirmButton.current?.focus({ preventScroll: true });
    else reviewButton.current?.focus({ preventScroll: true });
  }, [confirming]);

  const update = (index: number, patch: Partial<ReceiptItem>) =>
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );

  if (!editable && !applied)
    return (
      <Text as="p" variant="caption">
        {receipt.status === "cancelled"
          ? "요청 처리를 취소했어요."
          : "확인 기간이 끝났어요."}
      </Text>
    );

  const title = isReceipt ? "영수증 품목 확인" : "재고 변경 확인";

  return (
    <section
      aria-label={isReceipt ? "영수증 확인" : "변경 제안 확인"}
      className="flex flex-col gap-4 py-4 text-body-sm leading-[1.55]"
    >
      {applied && isReceipt && (
        <>
          <Text
            as="p"
            variant="label"
            role="status"
            className="text-success-text"
          >
            {selectedItems.length}개를 재고에 반영했어요
          </Text>
          <ReceiptSummary
            items={selectedItems}
            inventory={inventory}
            meta={meta}
          />
        </>
      )}
      {applied && !isReceipt && (
        <>
          <Text as="h3" variant="label">
            {title}
          </Text>
          {receipt.items.map((item, index) => (
            <ReceiptItemFields
              key={index}
              item={item}
              index={index}
              inventory={inventory}
              meta={meta}
              disabled
              applied
              onUpdate={(patch) => update(index, patch)}
            />
          ))}
          <div className="flex gap-2">
            <Button size="sm" className="text-body-sm" disabled aria-pressed>
              확인
            </Button>
          </div>
        </>
      )}
      {editable && confirming && (
        <>
          <Text as="h3" variant="label">
            {selectedItems.length}개를 재고에 반영할게요
          </Text>
          <ReceiptSummary
            items={selectedItems}
            inventory={inventory}
            meta={meta}
          />
          <div className="flex gap-2">
            <Button
              ref={confirmButton}
              size="sm"
              className="text-body-sm"
              disabled={!canApply}
              onClick={() =>
                mutation.mutate({
                  id: receipt.id,
                  version: receipt.version,
                  items: selectedItems,
                })
              }
            >
              반영하기
            </Button>
            <Button
              size="sm"
              className="text-body-sm"
              variant="gray"
              disabled={mutation.isPending}
              onClick={() => setConfirming(false)}
            >
              돌아가기
            </Button>
          </div>
        </>
      )}
      {editable && !confirming && (
        <>
          <Text as="h3" variant="label">
            {title}
          </Text>
          <Text as="p" variant="caption">
            {items.length}개 중 {selectedItems.length}개 선택
          </Text>
          <Accordion asChild type="multiple">
            <List variant="divided">
              {items.map((item, index) => (
                <ReceiptItemRow
                  key={index}
                  kind={receipt.kind}
                  item={item}
                  index={index}
                  inventory={inventory}
                  meta={meta}
                  disabled={mutation.isPending}
                  onUpdate={(patch) => update(index, patch)}
                />
              ))}
            </List>
          </Accordion>
          {blockers.length > 0 && (
            <Banner variant="warning" role="status">
              {blockers.join(" · ")}를 확인해 주세요.
            </Banner>
          )}
          <div className="flex gap-2">
            <Button
              ref={reviewButton}
              size="sm"
              className="text-body-sm"
              disabled={!canApply}
              onClick={() => {
                if (isReceipt) {
                  setConfirming(true);
                  return;
                }
                mutation.mutate({
                  id: receipt.id,
                  version: receipt.version,
                  items,
                });
              }}
            >
              재고에 반영하기
            </Button>
            <Button
              size="sm"
              className="text-body-sm"
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
        </>
      )}
      {mutation.error && (
        <Text as="p" variant="caption" role="alert" className="text-error-text">
          {mutation.error.message}
        </Text>
      )}
    </section>
  );
};

export default ReceiptCard;
