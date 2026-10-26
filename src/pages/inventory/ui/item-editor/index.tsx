"use client";
import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { compareItemNames } from "@/shared/lib";
import {
  inventoryInputSchema,
  inventoryStatusOptions,
  useInventoryActions,
  type InventoryItem,
  type InventoryInput,
  type InventoryMeta,
} from "@/entities/inventory-item";
import {
  Sheet,
  TextButton,
  Input,
  FormFieldRow,
  GroupLabel,
  SegmentedControl,
  ConfirmDialog,
  Text,
  Button,
} from "@/shared/ui";
import InventoryItemDetails from "./Details";
import { DateTimeInput } from "@/shared/ui/date-time-input";
interface Props {
  item?: InventoryItem;
  initialName?: string;
  items: InventoryItem[];
  meta: InventoryMeta;
  onClose: () => void;
  onNotify: (message: string) => void;
}
const InventoryItemEditor = ({
  item,
  initialName = "",
  items,
  meta,
  onClose,
  onNotify,
}: Props) => {
  const actions = useInventoryActions();
  const [editing, setEditing] = useState(!item);
  const [mergeId, setMergeId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [separateName, setSeparateName] = useState<string | null>(null);
  const defaults: InventoryInput = item ?? {
    name: initialName,
    mode: "quantity",
    quantity: 1,
    status: "enough",
    unit_id: meta.units[0]?.id ?? null,
    category_id: null,
    location_id: null,
    min_quantity: null,
    expires_on: null,
  };
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<InventoryInput>({
    resolver: zodResolver(inventoryInputSchema),
    defaultValues: defaults,
  });
  const name = useWatch({ control, name: "name" });
  const mode = useWatch({ control, name: "mode" });
  const expiry = useWatch({ control, name: "expires_on" });
  const similar = !item
    ? items.filter(
        (candidate) => compareItemNames(candidate.name, name) !== "different",
      )
    : [];
  const exact = similar.filter(
    (candidate) => compareItemNames(candidate.name, name) === "same",
  );
  const candidates = exact.length > 0 ? exact : similar;
  const mergeTarget =
    candidates.length === 1
      ? candidates[0]
      : candidates.find((candidate) => candidate.id === mergeId);
  const needsDecision = similar.length > 0 && separateName !== name;
  const pending = actions.save.isPending || actions.change.isPending;
  const close = () => {
    if (pending) return;
    if (isDirty) setClosing(true);
    else onClose();
  };
  const save = handleSubmit(async (input) => {
    if (needsDecision) {
      setError("name", {
        message: "기존 품목에 더할지 새로 등록할지 골라 주세요.",
      });
      return;
    }
    if (item && !isDirty) {
      onClose();
      return;
    }
    try {
      await actions.save.mutateAsync({
        action: "save",
        id: item?.id,
        item: input,
      });
      onNotify("품목을 저장했어요.");
      onClose();
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "저장하지 못했어요.",
      });
    }
  });
  const merge = handleSubmit(async (input) => {
    const target = mergeTarget;
    if (!target || target.mode !== "quantity" || input.mode !== "quantity") {
      setError("name", {
        message: "수량 품목끼리만 더할 수 있어요. 새로 등록해 주세요.",
      });
      return;
    }
    if (target.unit_id !== input.unit_id) {
      setError("unit_id", {
        message: "기존 품목과 같은 단위를 선택해 주세요.",
      });
      return;
    }
    try {
      await actions.save.mutateAsync({
        action: "merge",
        id: target.id,
        delta: input.quantity,
      });
      onNotify("기존 품목에 수량을 더했어요.");
      onClose();
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "더하지 못했어요.",
      });
    }
  });
  const remove = async () => {
    if (!item) return;
    try {
      await actions.save.mutateAsync({ action: "delete", id: item.id });
      onNotify("품목을 삭제했어요.");
      onClose();
    } catch (error) {
      setDeleting(false);
      setError("root", {
        message: error instanceof Error ? error.message : "삭제하지 못했어요.",
      });
    }
  };
  const usedUp = async () => {
    if (!item) return;
    try {
      await actions.onChange({ action: "used-up", id: item.id });
      onNotify("다 쓴 품목으로 바꿨어요.");
      onClose();
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "변경하지 못했어요.",
      });
    }
  };
  const options = [
    { field: "unit_id", label: "단위", entries: meta.units, odId: "n-unit" },
    {
      field: "category_id",
      label: "카테고리",
      entries: meta.categories,
      odId: "n-category",
    },
    {
      field: "location_id",
      label: "보관 장소",
      entries: meta.locations.filter(
        (entry) => entry.enabled || entry.id === item?.location_id,
      ),
      odId: "n-location",
    },
  ] as const;
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={item ? (editing ? "품목 수정" : "품목") : "새 품목"}
        description={
          editing
            ? "품목 이름과 관리 방법을 입력해 주세요."
            : "등록한 품목의 정보예요."
        }
        odId={item ? "sheet-item-detail" : "sheet-new-item"}
        leadingAction={
          editing
            ? () => (
                <TextButton
                  disabled={pending}
                  data-od-id={item ? undefined : "new-item-cancel"}
                  onClick={close}
                >
                  취소
                </TextButton>
              )
            : undefined
        }
        action={
          <TextButton
            disabled={pending}
            data-od-id={item ? "item-done" : "new-item-save"}
            onClick={() => (editing ? void save() : onClose())}
          >
            {pending ? "저장 중" : item ? "완료" : "추가"}
          </TextButton>
        }
      >
        {item && !editing ? (
          <InventoryItemDetails
            item={item}
            meta={meta}
            pending={pending}
            onEdit={() => setEditing(true)}
            onUsedUp={() => void usedUp()}
            onDelete={() => setDeleting(true)}
          />
        ) : (
          <form onSubmit={save} className="grid gap-1">
            <FormFieldRow
              label="품목 이름"
              htmlFor="inventory-name"
              invalid={!!errors.name}
              error={errors.name?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("name")}
                  data-od-id="n-name"
                  autoComplete="off"
                  list="inventory-names"
                />
              )}
            </FormFieldRow>
            <datalist id="inventory-names">
              {similar.map((candidate) => (
                <option key={candidate.id} value={candidate.name} />
              ))}
            </datalist>
            {needsDecision && (
              <div
                data-od-id="n-similar"
                className="my-3 bg-muted p-3 text-body-sm"
              >
                <p>
                  {exact.length > 0 ? "같은" : "비슷한"} 이름의 품목이 있어요.
                  기존 품목에 더할까요?
                </p>
                {candidates.length > 1 && (
                  <select
                    aria-label="더할 품목 선택"
                    value={mergeTarget?.id ?? ""}
                    onChange={(event) => setMergeId(event.target.value)}
                  >
                    <option value="">품목 선택</option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ·{" "}
                        {meta.locations.find(
                          (entry) => entry.id === candidate.location_id,
                        )?.name ?? "보관 장소 없음"}{" "}
                        · {candidate.quantity}
                        {meta.units.find(
                          (entry) => entry.id === candidate.unit_id,
                        )?.name ?? ""}
                      </option>
                    ))}
                  </select>
                )}
                {mergeTarget && <p>‘{mergeTarget.name}’에 더해요.</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending || !mergeTarget}
                    data-od-id="similar-merge"
                    aria-disabled={!mergeTarget}
                    onClick={() => void merge()}
                  >
                    기존 품목에 더하기
                  </Button>
                  <Button
                    size="sm"
                    variant="gray"
                    data-od-id="similar-new"
                    onClick={() => setSeparateName(name)}
                  >
                    새로 등록
                  </Button>
                </div>
              </div>
            )}
            <GroupLabel>관리 방식</GroupLabel>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <SegmentedControl
                  odId="n-mode"
                  label="관리 방식"
                  options={[
                    { value: "quantity", label: "정확한 수량" },
                    { value: "status", label: "상태로만" },
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            {mode === "quantity" ? (
              <>
                <FormFieldRow
                  label="수량"
                  htmlFor="inventory-quantity"
                  invalid={!!errors.quantity}
                  error={errors.quantity?.message}
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min="0"
                      step="any"
                      {...register("quantity", { valueAsNumber: true })}
                    />
                  )}
                </FormFieldRow>
                <FormFieldRow
                  label="최소 수량"
                  htmlFor="inventory-min"
                  invalid={!!errors.min_quantity}
                  error={errors.min_quantity?.message}
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min="0"
                      step="any"
                      {...register("min_quantity", {
                        setValueAs: (value: string) =>
                          value === "" ? null : Number(value),
                      })}
                      placeholder="선택"
                    />
                  )}
                </FormFieldRow>
              </>
            ) : (
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <SegmentedControl
                    label="상태"
                    options={inventoryStatusOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                )}
              />
            )}
            {options
              .filter(
                (option) => option.field !== "unit_id" || mode === "quantity",
              )
              .map(({ field, label, entries, odId }) => (
                <FormFieldRow
                  key={field}
                  label={label}
                  htmlFor={`inventory-${field}`}
                  invalid={!!errors[field]}
                  error={errors[field]?.message}
                >
                  {(props) => (
                    <select
                      {...props}
                      data-od-id={odId}
                      {...register(field, {
                        setValueAs: (value: string) => value || null,
                      })}
                    >
                      <option value="">선택 안 함</option>
                      {entries.map((entry) => (
                        <option
                          key={entry.id}
                          value={entry.id}
                          disabled={field === "location_id" && !entry.enabled}
                        >
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  )}
                </FormFieldRow>
              ))}
            <FormFieldRow
              label="유통기한"
              htmlFor="inventory-expiry"
              invalid={!!errors.expires_on}
              error={errors.expires_on?.message}
            >
              {(props) => (
                <DateTimeInput
                  controlProps={props}
                  label="유통기한"
                  dateOnly
                  singleDate
                  pickerOdId="n-expiry"
                  range={{
                    startDate: expiry ?? "",
                    endDate: expiry ?? "",
                    startTime: "",
                    endTime: "",
                  }}
                  dateInputProps={{
                    "data-od-id": "n-expiry",
                    value: expiry ?? "",
                    onChange: (event) =>
                      setValue("expires_on", event.target.value || null, {
                        shouldDirty: true,
                      }),
                  }}
                  onConfirm={(range) =>
                    setValue("expires_on", range.startDate || null, {
                      shouldDirty: true,
                    })
                  }
                />
              )}
            </FormFieldRow>
            {expiry && (
              <TextButton
                onClick={() =>
                  setValue("expires_on", null, { shouldDirty: true })
                }
              >
                유통기한 지우기
              </TextButton>
            )}
          </form>
        )}
        {errors.root && (
          <Text
            as="p"
            role="alert"
            variant="caption"
            className="text-destructive"
          >
            {errors.root.message}
          </Text>
        )}
      </Sheet>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        targetName={item?.name ?? ""}
        title="품목을 삭제할까요?"
        description="삭제한 품목은 되돌릴 수 없어요."
        pending={pending}
        onConfirm={() => void remove()}
      />
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        targetName={name || "새 품목"}
        title="변경 내용을 저장할까요?"
        description="저장하지 않은 변경 내용이 있어요."
        confirmLabel="저장"
        cancelLabel="계속 편집"
        destructive={false}
        secondaryAction={{ label: "저장 안 함", onClick: onClose }}
        onConfirm={() => {
          setClosing(false);
          void save();
        }}
      />
    </>
  );
};
export default InventoryItemEditor;
