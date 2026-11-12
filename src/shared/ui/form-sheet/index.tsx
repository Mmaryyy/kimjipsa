"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Sheet } from "../sheet";
import { TextButton } from "../text-button";
import { useConfirm, useConfirmDisabled } from "../confirm-context";
import type { SheetProps } from "../overlay.types";
import type { ReactNode } from "react";

type FormSheetProps = Omit<SheetProps, "children"> & {
  children: ReactNode | ((formId: string, onSaved: () => void) => ReactNode);
  onSaved?: () => void;
  onCancel?: () => void;
  formId?: string;
  dirty: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  submitDisabled?: boolean;
  editable?: boolean;
  submitOdId?: string;
  cancelOdId?: string;
};

export function FormSheet({
  dirty,
  onSaved,
  onCancel,
  formId: providedFormId,
  onOpenChange,
  children,
  submitLabel = "저장",
  cancelLabel = "취소",
  pending = false,
  submitDisabled = false,
  editable = true,
  submitOdId,
  cancelOdId,
  action,
  leadingAction,
  ...props
}: FormSheetProps) {
  const generatedId = useId();
  const formId = providedFormId ?? generatedId;
  const confirm = useConfirm();
  const saveDisabled = useConfirmDisabled(submitDisabled || pending);
  const confirming = useRef(false);
  const [cancelAfterSave, setCancelAfterSave] = useState(false);
  const onChange = useCallback(
    async (open: boolean, cancel = false) => {
      if (pending || confirming.current) return;
      if (open || !dirty) {
        if (!open && cancel && onCancel) onCancel();
        else onOpenChange(open);
        return;
      }
      confirming.current = true;
      let discard = false;
      const save = await confirm({
        targetName: "변경 사항",
        title: "저장할까요?",
        description: "변경 사항을 저장하거나 저장하지 않고 닫을 수 있어요.",
        confirmLabel: "저장",
        cancelLabel: "계속 편집",
        destructive: false,
        onConfirm: () => {
          if (saveDisabled())
            throw new Error(
              "지금은 저장할 수 없어요. 입력 내용과 연결을 확인해 주세요.",
            );
        },
        secondaryAction: {
          label: "저장 안 함",
          onClick: () => {
            discard = true;
          },
        },
      });
      confirming.current = false;
      if (discard) {
        if (cancel && onCancel) onCancel();
        else onOpenChange(false);
      } else if (save) {
        setCancelAfterSave(cancel);
        requestAnimationFrame(() => {
          const form = document.getElementById(formId);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        });
      }
    },
    [dirty, pending, onOpenChange, onCancel, confirm, formId, saveDisabled],
  );
  const completeSave = () => {
    if (cancelAfterSave && onCancel) onCancel();
    else onSaved?.();
    setCancelAfterSave(false);
  };
  return (
    <Sheet
      {...props}
      onOpenChange={(open) => void onChange(open)}
      leadingAction={
        editable
          ? () => (
              <TextButton
                disabled={pending}
                data-od-id={cancelOdId}
                onClick={() => void onChange(false, true)}
              >
                {cancelLabel}
              </TextButton>
            )
          : leadingAction
      }
      action={
        editable ? (
          <TextButton
            key="submit"
            type="submit"
            form={formId}
            disabled={pending || submitDisabled}
            data-od-id={submitOdId}
          >
            {submitLabel}
          </TextButton>
        ) : (
          action
        )
      }
    >
      {typeof children === "function"
        ? children(formId, completeSave)
        : children}
    </Sheet>
  );
}
