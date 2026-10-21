"use client";

import { useRef, type ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/shared/lib";
import type { OverlayProps } from "./overlay.types";
import { TextButton } from "./text-button";

/** Vaul을 쓰는 유일한 진입점. 폼 스크롤과 드래그 판정은 같은 스크롤 컨테이너에서 처리한다. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  action,
  closeLabel = "취소",
  closePosition = "start",
  odId,
  closeOdId,
  theme,
}: OverlayProps & {
  children: ReactNode;
  action?: ReactNode;
  closeLabel?: string;
  closePosition?: "start" | "end";
  odId?: string;
  closeOdId?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  function onChange(next: boolean) {
    // 닫기를 보류한 제어형 폼도 드래그 위치에서 벗어나 원래 자리에 남아야 한다.
    if (!next) {
      contentRef.current?.style.removeProperty("transform");
      overlayRef.current?.style.removeProperty("opacity");
    }
    onOpenChange(next);
  }
  const closeButton = (
    <DrawerPrimitive.Close asChild>
      <TextButton data-od-id={closeOdId}>{closeLabel}</TextButton>
    </DrawerPrimitive.Close>
  );
  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onChange}
      shouldScaleBackground={false}
      repositionInputs={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay ref={overlayRef} className="kj-overlay" />
        <DrawerPrimitive.Content
          ref={contentRef}
          data-theme={theme}
          data-od-id={odId}
          className={cn([
            "fixed inset-x-0 bottom-0 z-81 max-h-[var(--sheet-mobile-max-height)]",
            "overflow-y-auto overscroll-contain rounded-t-[var(--sp-6)] bg-background px-4",
            "pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))] text-foreground",
            "[overflow-wrap:anywhere] shadow-[var(--shadow-sheet)] outline-none after:hidden",
          ])}
        >
          <div className="sticky top-0 z-1 bg-background pt-3">
            <div
              aria-hidden
              className="mx-auto h-1 w-10 rounded-full bg-[var(--sys-gray3)]"
            />
            <header className="grid min-h-12 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2">
              <div className="justify-self-start">
                {closePosition === "start" && closeButton}
              </div>
              <DrawerPrimitive.Title className="text-headline">
                {title}
              </DrawerPrimitive.Title>
              <div className="justify-self-end">
                {action}
                {closePosition === "end" && closeButton}
              </div>
            </header>
          </div>
          <DrawerPrimitive.Description className="sr-only">
            {description}
          </DrawerPrimitive.Description>
          {children}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
