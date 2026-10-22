"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { ConfirmDialog, Sheet } from "@/shared/ui";

export function EventEditorSheet({
  dirty,
  formId,
  onOpenChange,
  ...props
}: ComponentProps<typeof Sheet> & { dirty: boolean; formId?: string }) {
  const [confirming, setConfirming] = useState(false);
  const historyId = useId();
  const historyEffect = useRef({ version: 0 });
  const onChange = useCallback(
    (open: boolean) => {
      if (!open && dirty) setConfirming(true);
      else onOpenChange(open);
    },
    [dirty, onOpenChange],
  );
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (!props.open) return;
    const lifecycle = historyEffect.current;
    const version = ++lifecycle.version;
    const state = { ...window.history.state, eventEditor: historyId };
    if (window.history.state?.eventEditor !== historyId)
      window.history.pushState(state, "");
    const onBack = () => {
      // 닫기 확인 동안 현재 경로와 폼을 유지한다.
      window.history.pushState(state, "");
      changeRef.current(false);
    };
    window.addEventListener("popstate", onBack);
    return () => {
      window.removeEventListener("popstate", onBack);
      // Strict Mode의 효과 재설정에서는 살아 있는 시트 기록을 지우지 않는다.
      queueMicrotask(() => {
        if (
          lifecycle.version === version &&
          window.history.state?.eventEditor === historyId
        )
          window.history.back();
      });
    };
  }, [props.open, historyId]);
  return (
    <>
      <Sheet {...props} onOpenChange={onChange} />
      <ConfirmDialog
        open={confirming && props.open}
        onOpenChange={setConfirming}
        targetName="변경 사항"
        title="저장할까요?"
        description="변경 사항을 저장하거나 저장하지 않고 닫을 수 있어요."
        confirmLabel="저장"
        cancelLabel="계속 편집"
        secondaryAction={{
          label: "저장 안 함",
          onClick: () => {
            setConfirming(false);
            onOpenChange(false);
          },
        }}
        destructive={false}
        onConfirm={() => {
          setConfirming(false);
          requestAnimationFrame(() => {
            const form = formId ? document.getElementById(formId) : null;
            if (form instanceof HTMLFormElement) form.requestSubmit();
          });
        }}
      />
    </>
  );
}
