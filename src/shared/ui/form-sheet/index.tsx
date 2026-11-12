"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type RefObject,
} from "react";
import { Sheet } from "../sheet";
import { TextButton } from "../text-button";
import {
  ConfirmOpenContext,
  useConfirm,
  useConfirmDisabled,
} from "../confirm-context";
import type { SheetProps } from "../overlay.types";
import type { ReactNode } from "react";

export const FormSheetBackContext = createContext<RefObject<
  (() => void) | null
> | null>(null);

type FormSheetProps = Omit<SheetProps, "children" | "leadingAction"> & {
  children: ReactNode | ((formId: string) => ReactNode);
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
  ...props
}: FormSheetProps) {
  const generatedId = useId();
  const formId = providedFormId ?? generatedId;
  const confirm = useConfirm();
  const isConfirmOpen = useContext(ConfirmOpenContext);
  const childBack = useRef<(() => void) | null>(null);
  const saveDisabled = useConfirmDisabled(submitDisabled || pending);
  const confirming = useRef(false);
  const historyId = useId();
  const historyEffect = useRef({ version: 0 });
  const onChange = useCallback(
    async (open: boolean) => {
      if (pending || confirming.current) return;
      if (open || !dirty) {
        onOpenChange(open);
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
      if (discard) onOpenChange(false);
      else if (save) {
        requestAnimationFrame(() => {
          const form = document.getElementById(formId);
          if (form instanceof HTMLFormElement) form.requestSubmit();
        });
      }
    },
    [dirty, pending, onOpenChange, confirm, formId, saveDisabled],
  );
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!props.open) return;
    const lifecycle = historyEffect.current;
    const version = ++lifecycle.version;
    const state = { ...window.history.state, formSheet: historyId };
    if (window.history.state?.formSheet !== historyId)
      window.history.pushState(state, "");
    const onBack = () => {
      // 닫기 확인 동안 현재 경로와 폼을 유지한다.
      window.history.pushState(state, "");
      if (isConfirmOpen()) return;
      if (childBack.current) {
        childBack.current();
        return;
      }
      void changeRef.current(false);
    };
    window.addEventListener("popstate", onBack);
    return () => {
      window.removeEventListener("popstate", onBack);
      // Strict Mode의 효과 재설정에서는 살아 있는 시트 기록을 지우지 않는다.
      queueMicrotask(() => {
        if (
          lifecycle.version === version &&
          window.history.state?.formSheet === historyId
        )
          window.history.back();
      });
    };
  }, [props.open, historyId, isConfirmOpen]);
  return (
    <FormSheetBackContext.Provider value={childBack}>
      <Sheet
        {...props}
        onOpenChange={(open) => void onChange(open)}
        leadingAction={
          editable
            ? (change) => (
                <TextButton
                  disabled={pending}
                  data-od-id={cancelOdId}
                  onClick={() => change(false)}
                >
                  {cancelLabel}
                </TextButton>
              )
            : undefined
        }
        action={
          editable ? (
            <TextButton
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
        {typeof children === "function" ? children(formId) : children}
      </Sheet>
    </FormSheetBackContext.Provider>
  );
}
