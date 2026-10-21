"use client";

import { useState, type ComponentProps } from "react";
import { useMediaQuery } from "@/shared/lib";
import { ConfirmDialog, Drawer, Sheet } from "@/shared/ui";

export function EventEditorSheet({
  dirty,
  editing = true,
  onOpenChange,
  ...props
}: ComponentProps<typeof Sheet> & { dirty: boolean; editing?: boolean }) {
  const coarse = useMediaQuery("(pointer: coarse)");
  const [confirming, setConfirming] = useState(false);
  const Overlay = coarse && editing ? Drawer : Sheet;
  function onChange(open: boolean) {
    if (!open && dirty) setConfirming(true);
    else onOpenChange(open);
  }
  return (
    <>
      <Overlay {...props} onOpenChange={onChange} />
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
