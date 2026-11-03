"use client";

import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { cn, useDismissOnOutside } from "@/shared/lib";
import { TextButton } from "@/shared/ui";
import { inventoryStatusOptions } from "../../model/inventory.schema";
import type { InventoryItem } from "../../api/type";
import { inventoryStatusCapsuleStyles } from "./status-capsule.variants";

interface Props {
  label: string;
  value: InventoryItem["status"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: InventoryItem["status"]) => void;
}

const InventoryStatusCapsule = ({
  label,
  value,
  open,
  onOpenChange,
  onValueChange,
}: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (open) selectedRef.current?.focus();
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [open]);
  const close = useCallback(() => {
    flushSync(() => onOpenChange(false));
    selectedRef.current?.focus();
  }, [onOpenChange]);
  useDismissOnOutside(rootRef, open, close);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`${label} 상태`}
      className={inventoryStatusCapsuleStyles({ status: value, open })}
    >
      {inventoryStatusOptions.map((option) => {
        const selected = option.value === value;
        const visible = open || selected;
        return (
          <span
            key={option.value}
            inert={!visible}
            aria-hidden={!visible}
            className={cn(
              [
                "grid overflow-hidden grid-cols-[minmax(0,0fr)] opacity-0",
                "transition-[grid-template-columns,opacity] duration-[320ms]",
                "ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              ],
              visible && "grid-cols-[minmax(0,1fr)] opacity-100",
            )}
          >
            <TextButton
              ref={selected ? selectedRef : undefined}
              aria-label={
                open ? option.label : `${label} ${option.label}, 눌러서 바꾸기`
              }
              aria-pressed={open ? selected : undefined}
              aria-expanded={open}
              tabIndex={visible ? 0 : -1}
              className={cn(
                [
                  "focus-visible:outline-offset-[calc(-1*var(--sp-2))] relative isolate h-11",
                  "min-w-0 overflow-hidden rounded-full px-0 text-caption font-semibold",
                  "whitespace-nowrap text-muted-foreground transition-[padding,color]",
                  "duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)]",
                  "motion-reduce:transition-none",
                ],
                visible && "px-3",
                selected && "text-[var(--capsule-text)]",
                open &&
                  selected && [
                    "before:absolute before:inset-x-0 before:top-1/2 before:-z-10",
                    "before:h-[calc(var(--ctl-h-sm)-var(--sp-half))] before:-translate-y-1/2",
                    "before:rounded-full before:bg-[var(--control-selected-bg)]",
                    "before:shadow-control",
                  ],
              )}
              onClick={() => {
                if (!open) {
                  onOpenChange(true);
                  return;
                }
                onValueChange(option.value);
                if (timerRef.current !== null) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => {
                  flushSync(() => onOpenChange(false));
                  selectedRef.current?.focus();
                }, 260);
              }}
            >
              {option.label}
            </TextButton>
          </span>
        );
      })}
    </div>
  );
};
export default InventoryStatusCapsule;
