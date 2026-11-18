"use client";
import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { compareItemNames } from "@/shared/lib";
import {
  inventoryInputSchema,
  inventoryStatusOptions,
  type InventoryItem,
  type InventoryInput,
  type InventoryMeta,
} from "@/entities/inventory-item";
import {
  FormSheet,
  TextButton,
  Input,
  FormField,
  GroupLabel,
  SegmentedControl,
  Text,
  Button,
} from "@/shared/ui";
import { useItemActions } from "../../model/use-item-actions";
import InventoryItemDetails from "./Details";
const Field = FormField<InventoryInput>;
interface Props {
  item?: InventoryItem;
  initialAction?: "edit";
  initialName?: string;
  items: InventoryItem[];
  meta: InventoryMeta;
  onClose: () => void;
  onUsedUp?: (item: InventoryItem) => void;
  onNotify: (message: string) => void;
}
const InventoryItemEditor = ({
  item,
  initialAction,
  initialName = "",
  items,
  meta,
  onClose,
  onNotify,
  onUsedUp,
}: Props) => {
  const { actions, remove, usedUp } = useItemActions({
    onClose,
    onNotify,
    onUsedUp,
  });
  const [editing, setEditing] = useState(!item || initialAction === "edit");
  const [mergeId, setMergeId] = useState<string | null>(null);
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
  const form = useForm<InventoryInput>({
    resolver: zodResolver(inventoryInputSchema),
    defaultValues: defaults,
  });
  const {
    reset,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = form;
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

  const save = (onSaved: () => void) =>
    handleSubmit(async (input) => {
      if (needsDecision) {
        setError("name", {
          message: "기존 품목에 더할지 새로 등록할지 골라 주세요.",
        });
        return;
      }
      if (item && !isDirty) {
        onSaved();
        return;
      }
      try {
        await actions.save.mutateAsync({
          action: "save",
          id: item?.id,
          item: input,
        });
        reset(input);
        onNotify("품목을 저장했어요.");
        onSaved();
      } catch (error) {
        setError("root", {
          message:
            error instanceof Error ? error.message : "저장하지 못했어요.",
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
  const markUsedUp = async () => {
    if (!item) return;
    try {
      await usedUp(item);
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
    <FormProvider {...form}>
      <FormSheet
        onSaved={onClose}
        onCancel={
          item && initialAction !== "edit"
            ? () => {
                reset();
                setEditing(false);
              }
            : undefined
        }
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={item ? (editing ? "품목 수정" : "품목") : "새 품목"}
        description={
          editing
            ? "품목 이름과 관리 방법을 입력해 주세요."
            : "등록한 품목의 정보예요."
        }
        odId={item ? "sheet-item-detail" : "sheet-new-item"}
        dirty={isDirty}
        pending={pending}
        editable={editing}
        cancelOdId={item ? undefined : "new-item-cancel"}
        submitOdId={item ? "item-done" : "new-item-save"}
        submitLabel={pending ? "저장 중" : item ? "저장" : "추가"}
        leadingAction={() => (
          <TextButton
            tone="danger"
            aria-label="품목 삭제"
            data-od-id="item-delete"
            disabled={pending}
            onClick={() => item && void remove(item)}
          >
            삭제
          </TextButton>
        )}
        action={
          <TextButton
            disabled={pending}
            aria-label="품목 수정"
            data-od-id="item-edit"
            onClick={() => setEditing(true)}
          >
            수정
          </TextButton>
        }
      >
        {(formId, onSaved) => (
          <>
            {item && !editing ? (
              <InventoryItemDetails
                item={item}
                meta={meta}
                pending={pending}
                onUsedUp={() => void markUsedUp()}
              />
            ) : (
              <form id={formId} onSubmit={save(onSaved)} className="grid gap-1">
                <Field
                  label="품목 이름"
                  name="name"
                  render={(field) => (
                    <Input
                      {...field}
                      data-od-id="n-name"
                      autoComplete="off"
                      list="inventory-names"
                    />
                  )}
                />
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
                      {exact.length > 0 ? "같은" : "비슷한"} 이름의 품목이
                      있어요. 기존 품목에 더할까요?
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
                <Field
                  name="mode"
                  label="관리 방식"
                  showLabel={false}
                  className="block min-h-0 p-0 [&>div]:block"
                  render={(field) => (
                    <SegmentedControl
                      id={field.id}
                      aria-invalid={field["aria-invalid"]}
                      aria-describedby={field["aria-describedby"]}
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
                    <Field
                      name="quantity"
                      label="수량"
                      type="number"
                      inputProps={{ min: 0, step: "any" }}
                    />
                    <Field
                      name="min_quantity"
                      label="최소 수량"
                      type="number"
                      inputProps={{ min: 0, step: "any", placeholder: "선택" }}
                      parse={(value) => (Number.isNaN(value) ? null : value)}
                    />
                  </>
                ) : (
                  <Field
                    name="status"
                    label="상태"
                    showLabel={false}
                    className="block min-h-0 p-0 [&>div]:block"
                    render={(field) => (
                      <SegmentedControl
                        id={field.id}
                        aria-invalid={field["aria-invalid"]}
                        aria-describedby={field["aria-describedby"]}
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
                    (option) =>
                      option.field !== "unit_id" || mode === "quantity",
                  )
                  .map(({ field, label, entries, odId }) => (
                    <Field
                      key={field}
                      name={field}
                      label={label}
                      type="select"
                      noneLabel="선택 안 함"
                      options={entries.map((entry) => ({
                        value: entry.id,
                        label: entry.name,
                        disabled: field === "location_id" && !entry.enabled,
                      }))}
                      inputProps={{ "data-od-id": odId }}
                    />
                  ))}
                <Field
                  name="expires_on"
                  label="유통기한"
                  type="date"
                  pickerOdId="n-expiry"
                />
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
          </>
        )}
      </FormSheet>
    </FormProvider>
  );
};
export default InventoryItemEditor;
