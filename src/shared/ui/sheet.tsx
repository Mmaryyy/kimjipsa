"use client";
import { useContext, useEffect, useId, useRef } from "react";
import { ConfirmOpenContext } from "./confirm-context";
import { cn, useMediaQuery } from "@/shared/lib";

import { Dialog } from "radix-ui";
import { SheetHeader } from "./sheet-header";
import { Drawer } from "./drawer";
import { sheetStyles } from "./sheet.variants";
import type { SheetProps } from "./overlay.types";
const openSheets: string[] = [];

function useSheetHistory({
  open,
  onOpenChange,
  presentation,
  historyManaged,
}: SheetProps) {
  const id = useId();
  const onChange = useRef(onOpenChange);
  const lifecycle = useRef({ version: 0 });
  const isConfirmOpen = useContext(ConfirmOpenContext);
  useEffect(() => {
    onChange.current = onOpenChange;
  }, [onOpenChange]);
  useEffect(() => {
    if (!open || historyManaged || presentation === "panel") return;
    const current = lifecycle.current;
    const version = ++current.version;
    const state = { ...window.history.state, formSheet: id };
    openSheets.push(id);
    const previousId = window.history.state?.formSheet;
    if (previousId !== id) {
      // 품목 상세에서 다 쓴 뒤 시트로 교체할 때 닫힌 시트 기록을 남기지 않는다.
      if (previousId && !openSheets.includes(previousId))
        window.history.replaceState(state, "");
      else window.history.pushState(state, "");
    }
    const onBack = (event: PopStateEvent) => {
      // 중첩 시트와 닫힌 시트의 기록 정리는 아래 시트를 닫지 않는다.
      if (openSheets.at(-1) !== id || event.state?.formSheet === id) return;
      window.history.pushState(state, "");
      if (!isConfirmOpen()) onChange.current(false);
    };
    window.addEventListener("popstate", onBack);
    return () => {
      window.removeEventListener("popstate", onBack);
      openSheets.splice(openSheets.lastIndexOf(id), 1);
      // Strict Mode 재설정에서는 살아 있는 시트 기록을 유지한다.
      queueMicrotask(() => {
        if (
          current.version === version &&
          window.history.state?.formSheet === id
        )
          window.history.back();
      });
    };
  }, [open, id, presentation, historyManaged, isConfirmOpen]);
}

function DesktopSheet({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  theme,
  children,
  action,
  leadingAction,
  odId,
  className,
  onCloseAutoFocus,
  onOpenAutoFocus,
  hideHeader = false,
  overlayClassName,
  presentation = "sheet",
  onEscapeKeyDown,
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={cn("kj-overlay", overlayClassName)} />
        <Dialog.Content
          ref={contentRef}
          tabIndex={-1}
          aria-modal="true"
          className={cn(
            sheetStyles({ presentation }),
            "outline-none",
            className,
          )}
          onEscapeKeyDown={onEscapeKeyDown}
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(event) => {
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented) return;
            // React autoFocus로 이미 선택된 입력은 그대로 둔다.
            if (!contentRef.current?.contains(document.activeElement))
              contentRef.current?.focus({ preventScroll: true });
            event.preventDefault();
          }}
          data-theme={theme}
          data-od-id={odId}
        >
          {hideHeader ? (
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
          ) : (
            <div className="sticky top-0 z-1 bg-background">
              <SheetHeader
                title={
                  <Dialog.Title className="text-headline">{title}</Dialog.Title>
                }
                action={action}
                leadingAction={leadingAction}
                onOpenChange={onOpenChange}
              />
            </div>
          )}
          <Dialog.Description className="sr-only">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sheet(props: SheetProps) {
  useSheetHistory(props);
  const coarse = useMediaQuery("(pointer: coarse)");
  if (coarse && props.presentation !== "panel") {
    return <Drawer {...props} />;
  }
  return <DesktopSheet {...props} />;
}
