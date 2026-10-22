"use client";

import { useState, type ComponentProps } from "react";
import { ConfirmDialog, Sheet } from "@/shared/ui";

export function EventEditorSheet({
  dirty,
  onOpenChange,
  ...props
}: ComponentProps<typeof Sheet> & { dirty: boolean }) {
  const [confirming, setConfirming] = useState(false);
  function onChange(open: boolean) {
    if (!open && dirty) setConfirming(true);
    else onOpenChange(open);
  }
  return (
    <>
      <Sheet {...props} onOpenChange={onChange} />
      <ConfirmDialog
        open={confirming && props.open}
        onOpenChange={setConfirming}
        targetName="변경 사항"
        title="저장하지 않고 닫을까요?"
        description="입력한 변경 사항은 저장되지 않아요."
        confirmLabel="닫기"
        destructive={false}
        onConfirm={() => {
          setConfirming(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
