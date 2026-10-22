"use client";

import { createContext, useContext, useRef } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/shared/lib";
import type { SheetProps } from "./overlay.types";
import { SheetHeader } from "./sheet-header";

const DrawerContext = createContext(false);

/** Vaul을 쓰는 유일한 진입점. 폼 스크롤과 드래그 판정은 같은 스크롤 컨테이너에서 처리한다. */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  action,
  leadingAction,
  odId,
  theme,
  trigger,
  className,
  hideHeader = false,
  overlayClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: SheetProps) {
  const nested = useContext(DrawerContext);
  const Root = nested ? DrawerPrimitive.NestedRoot : DrawerPrimitive.Root;
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
  return (
    <Root
      open={open}
      onOpenChange={onChange}
      shouldScaleBackground={false}
      repositionInputs={false}
      autoFocus
    >
      <DrawerContext.Provider value={true}>
        {trigger && (
          <DrawerPrimitive.Trigger asChild>{trigger}</DrawerPrimitive.Trigger>
        )}
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay
            ref={overlayRef}
            className={cn("kj-overlay", overlayClassName)}
          />
          <DrawerPrimitive.Content
            ref={contentRef}
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={onCloseAutoFocus}
            data-theme={theme}
            data-od-id={odId}
            className={cn([
              "fixed inset-x-0 bottom-0 z-81 max-h-[var(--sheet-mobile-max-height)]",
              "overflow-y-auto overscroll-contain rounded-t-[var(--sp-6)] bg-background px-4",
              "pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))] text-foreground",
              "[overflow-wrap:anywhere] shadow-[var(--shadow-sheet)] outline-none after:hidden",
              className,
            ])}
          >
            <div className="sticky top-0 z-1 bg-background pt-3">
              <div
                aria-hidden
                className="mx-auto h-1 w-10 rounded-full bg-[var(--sys-gray3)]"
              />
              {hideHeader ? (
                <DrawerPrimitive.Title className="sr-only">
                  {title}
                </DrawerPrimitive.Title>
              ) : (
                <SheetHeader
                  title={
                    <DrawerPrimitive.Title className="text-headline">
                      {title}
                    </DrawerPrimitive.Title>
                  }
                  action={action}
                  leadingAction={leadingAction}
                  showCloseButton={false}
                  onOpenChange={onChange}
                />
              )}
            </div>
            <DrawerPrimitive.Description className="sr-only">
              {description}
            </DrawerPrimitive.Description>
            {children}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerContext.Provider>
    </Root>
  );
}
