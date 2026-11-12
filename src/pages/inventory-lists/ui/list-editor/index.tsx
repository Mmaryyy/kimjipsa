"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useInventoryActions,
  InventoryCategoryIcon,
  inventoryDefaultIcons,
  inventoryMetaInputSchema,
  type InventoryMetaEntry,
  type InventoryMetaInput,
  type InventoryListKind,
} from "@/entities/inventory-item";
import {
  FormSheet,
  TextButton,
  FormFieldRow,
  Input,
  Switch,
  Text,
  useConfirm,
} from "@/shared/ui";
interface Props {
  kind: InventoryListKind;
  nextSortOrder: number;
  entry?: InventoryMetaEntry;
  onClose: () => void;
  onNotify: (message: string) => void;
}
const InventoryListEditor = ({
  kind,
  entry,
  nextSortOrder,
  onClose,
  onNotify,
}: Props) => {
  const actions = useInventoryActions();
  const [editing, setEditing] = useState(!entry);
  const [defaultIcon] = useState(() =>
    entry
      ? (inventoryDefaultIcons[entry.name] ??
        (entry.icon_kind === "lucide" ? entry.icon_value : null))
      : null,
  );
  const confirm = useConfirm();
  const {
    reset,
    register,
    control,
    setValue,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<InventoryMetaInput>({
    resolver: zodResolver(inventoryMetaInputSchema),
    defaultValues: entry ?? {
      name: "",
      enabled: true,
      sort_order: nextSortOrder,
      icon_kind: null,
      icon_value: "",
    },
  });
  const iconKind = useWatch({ control, name: "icon_kind" });
  const iconValue = useWatch({ control, name: "icon_value" });
  const enabled = useWatch({ control, name: "enabled" });
  const name = useWatch({ control, name: "name" });
  const pending = actions.meta.isPending;
  const save = (onSaved: () => void) =>
    handleSubmit(async (input) => {
      if (entry && !isDirty) {
        onSaved();
        return;
      }
      try {
        await actions.meta.mutateAsync({
          action: "save",
          kind,
          id: entry?.id,
          entry: input,
        });
        reset(input);
        onNotify("목록을 저장했어요.");
        onSaved();
      } catch (error) {
        setError("root", {
          message:
            error instanceof Error ? error.message : "저장하지 못했어요.",
        });
      }
    });

  const remove = () =>
    confirm({
      targetName: entry?.name ?? "",
      title: "목록을 삭제할까요?",
      description:
        kind === "units"
          ? "사용 중인 단위는 품목의 단위를 먼저 바꿔야 해요."
          : kind === "categories"
            ? "품목은 기타 카테고리로 옮겨져요."
            : "품목은 유지되며 보관 장소만 비워져요.",
      onConfirm: async () => {
        await actions.meta.mutateAsync({
          action: "delete",
          kind,
          id: entry?.id,
        });
        onNotify("목록에서 삭제했어요.");
        onClose();
      },
    });
  return (
    <FormSheet
      onSaved={onClose}
      onCancel={
        entry
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
      title={entry ? (editing ? "목록 수정" : "목록") : "목록 추가"}
      editable={editing}
      leadingAction={() =>
        entry &&
        !(kind === "categories" && entry.name === "기타") && (
          <TextButton
            tone="danger"
            aria-label="목록 삭제"
            data-od-id="lists-delete"
            disabled={pending}
            onClick={() => void remove()}
          >
            삭제
          </TextButton>
        )
      }
      action={
        <TextButton
          aria-label="목록 수정"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          수정
        </TextButton>
      }
      description="가정에서 함께 사용하는 목록이에요."
      odId="lists-sheet"
      dirty={isDirty}
      pending={pending}
      submitOdId="lists-save"
    >
      {(formId, onSaved) =>
        !editing && entry ? (
          <div className="grid gap-3 py-4">
            <Text as="h2" variant="title">
              {entry.name}
            </Text>
            {kind === "categories" && (
              <InventoryCategoryIcon category={entry} />
            )}
            {kind === "locations" && (
              <Text>사용 · {entry.enabled ? "켬" : "끔"}</Text>
            )}
          </div>
        ) : (
          <form id={formId} onSubmit={save(onSaved)}>
            <FormFieldRow
              label="이름"
              htmlFor="lists-name"
              invalid={!!errors.name}
              error={errors.name?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  {...register("name")}
                  data-od-id="lists-name"
                />
              )}
            </FormFieldRow>
            {kind === "categories" && (
              <FormFieldRow
                label="아이콘"
                htmlFor="lists-icon"
                invalid={!!errors.icon_value}
                error={errors.icon_value?.message}
              >
                {(props) => (
                  <div className="flex items-center gap-2">
                    <InventoryCategoryIcon
                      category={{
                        name,
                        icon_kind: iconKind,
                        icon_value: iconValue,
                      }}
                    />
                    <Input
                      {...props}
                      data-od-id="lists-icon"
                      placeholder="이모지나 글자 하나"
                      value={iconKind === "text" ? iconValue : ""}
                      onChange={(event) => {
                        setValue(
                          "icon_kind",
                          event.target.value
                            ? "text"
                            : defaultIcon
                              ? "lucide"
                              : null,
                          {
                            shouldDirty: true,
                          },
                        );
                        setValue(
                          "icon_value",
                          event.target.value || defaultIcon || "",
                          {
                            shouldDirty: true,
                          },
                        );
                      }}
                    />
                    {defaultIcon && (
                      <TextButton
                        onClick={() => {
                          setValue("icon_kind", "lucide", {
                            shouldDirty: true,
                          });
                          setValue("icon_value", defaultIcon, {
                            shouldDirty: true,
                          });
                        }}
                      >
                        기본 아이콘
                      </TextButton>
                    )}
                  </div>
                )}
              </FormFieldRow>
            )}
            {kind === "locations" && (
              <>
                <FormFieldRow label="사용" htmlFor="lists-on">
                  {(props) => (
                    <Switch
                      {...props}
                      checked={enabled}
                      onCheckedChange={(value) =>
                        setValue("enabled", value, { shouldDirty: true })
                      }
                      data-od-id="lists-on"
                    />
                  )}
                </FormFieldRow>
                <Text
                  as="p"
                  variant="caption"
                  className="text-muted-foreground"
                >
                  끄면 보관 장소 선택지와 필터에서 숨겨져요. 품목은 전체 목록에
                  그대로 남아요.
                </Text>
              </>
            )}
            {errors.root && (
              <Text
                as="p"
                variant="caption"
                role="alert"
                className="text-destructive"
              >
                {errors.root.message}
              </Text>
            )}
          </form>
        )
      }
    </FormSheet>
  );
};
export default InventoryListEditor;
