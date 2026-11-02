"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/shared/lib";
import type { SheetProps } from "./overlay.types";
import { SheetHeader } from "./sheet-header";

const DrawerContext = createContext(false);

/** Vaul을 쓰는 유일한 진입점. 손잡이만 드래그하고 본문은 독립적으로 스크롤한다. */
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
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const bottom = Math.max(
        0,
        window.innerHeight - height - (viewport?.offsetTop ?? 0),
      );
      contentRef.current?.style.setProperty(
        "--drawer-viewport-height",
        `${height}px`,
      );
      contentRef.current?.style.setProperty("bottom", `${bottom}px`);
    };
    const frame = requestAnimationFrame(updateViewport);
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, [open]);
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
      handleOnly
      autoFocus={false}
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
            style={{ touchAction: "pan-y" }}
            onOpenAutoFocus={(event) => {
              onOpenAutoFocus?.(event);
              if (!event.defaultPrevented)
                contentRef.current?.focus({ preventScroll: true });
              event.preventDefault();
            }}
            onCloseAutoFocus={onCloseAutoFocus}
            data-theme={theme}
            data-od-id={odId}
            className={cn([
              "fixed inset-x-0 bottom-0 z-81 flex flex-col",
              "[--drawer-safe-height:calc(var(--drawer-viewport-height,100dvh)-env(safe-area-inset-top))]",
              "max-h-[min(var(--sheet-mobile-max-height),var(--drawer-safe-height))]",
              "overflow-hidden rounded-t-[var(--sp-6)] bg-background px-4",
              "text-foreground",
              "[overflow-wrap:anywhere] shadow-[var(--shadow-sheet)] outline-none after:hidden",
              className,
            ])}
          >
            <div className="shrink-0 bg-background pt-3">
              <DrawerPrimitive.Handle
                preventCycle
                style={{ touchAction: "none" }}
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
            <div
              className={cn([
                "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain",
                "pb-[calc(var(--sp-6)+env(safe-area-inset-bottom))]",
              ])}
            >
              {children}
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerContext.Provider>
    </Root>
  );
}
