"use client";

import { flushSync } from "react-dom";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "../button";
import { Input } from "../input";
import { TextButton } from "../text-button";
import { cn, useDismissOnOutside } from "@/shared/lib";

interface Props {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  unit?: string;
  allowDirectInput?: boolean;
  collapsible?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}

const QuantityStepper = ({
  label,
  value,
  onValueChange,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
  unit,
  allowDirectInput = false,
  collapsible,
}: Props) => {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef<HTMLButtonElement>(null);
  const increaseRef = useRef<HTMLButtonElement>(null);
  const expanded = collapsible?.open ?? false;
  const onOpenChange = collapsible?.onOpenChange;
  useEffect(() => {
    if (expanded) increaseRef.current?.focus();
  }, [expanded]);
  const close = useCallback(
    (event: MouseEvent | KeyboardEvent) => {
      if (event.type === "keydown") editing.current = false;
      flushSync(() => {
        onOpenChange?.(false);
        setDraft(null);
      });
      collapsedRef.current?.focus();
    },
    [onOpenChange],
  );
  useDismissOnOutside(rootRef, expanded && !!onOpenChange, close);
  const invalid =
    !Number.isFinite(value) || !Number.isFinite(step) || step <= 0 || min > max;
  const change = (direction: number) => {
    // 소수 단위도 부동소수점 잔여 자릿수 없이 조절해요.
    const next = Number((value + direction * step).toFixed(10));
    onValueChange(Math.min(max, Math.max(min, next)));
  };
  const finishEditing = (save: boolean) => {
    // Enter로 입력란을 닫을 때 뒤따르는 blur가 중복 저장하지 않게 해요.
    if (!editing.current) return;
    editing.current = false;
    setDraft(null);
    if (!save || disabled || invalid || draft === null) return;
    const text = draft.trim();
    const next = Number(text);
    if (
      /^\d*\.?\d+$/.test(text) &&
      Number.isFinite(next) &&
      next >= min &&
      next <= max &&
      next !== value
    ) {
      onValueChange(next);
    }
  };
  const unitLabel = unit && (
    <span className="text-caption font-normal text-muted-foreground pl-1">
      {unit}
    </span>
  );
  const quantityLabel = (
    <>
      {value}
      {collapsible && unitLabel}
    </>
  );
  let quantityControl = <output aria-live="polite">{quantityLabel}</output>;
  if (allowDirectInput || collapsible) {
    quantityControl =
      draft === null ? (
        <TextButton
          ref={collapsedRef}
          aria-expanded={collapsible ? expanded : undefined}
          className={cn(
            "min-h-[var(--ctl-h-xs)] min-w-11 w-full px-1 text-body font-semibold text-foreground tabular-nums",
            collapsible && [
              "focus-visible:outline-offset-[calc(-1*var(--sp-2))] h-11 gap-0 text-body-sm",
              "transition-[padding] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              "motion-reduce:transition-none",
            ],
            collapsible && !expanded && "px-3",
          )}
          aria-label={
            collapsible && !expanded
              ? `${label} 수량 ${value}${unit ?? ""}, 눌러서 바꾸기`
              : `${label} 수량 직접 입력`
          }
          disabled={disabled || invalid}
          onClick={() => {
            if (collapsible && !expanded) {
              editing.current = false;
              setDraft(null);
              collapsible.onOpenChange(true);
            } else if (allowDirectInput) {
              editing.current = true;
              setDraft(String(value));
            }
          }}
        >
          {quantityLabel}
        </TextButton>
      ) : (
        <>
          <label htmlFor={inputId} className="sr-only">
            {label} 수량
          </label>
          <Input
            id={inputId}
            type="text"
            inputMode="decimal"
            className={cn([
              "h-[var(--ctl-h-xs)] min-h-[var(--ctl-h-xs)] w-16 rounded-full",
              "bg-transparent px-1 py-0 text-center font-semibold tabular-nums",
            ])}
            value={draft}
            disabled={disabled}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEditing(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
                finishEditing(event.key === "Enter");
              }
            }}
          />
          {collapsible && unitLabel}
        </>
      );
  }
  return (
    <div
      ref={rootRef}
      className="inline-flex shrink-0 items-center gap-1"
      role="group"
      aria-label={label}
    >
      <div
        className={cn(
          "inline-flex items-center rounded-full bg-sys-gray5 py-[calc((var(--hit)-var(--ctl-h-xs))/2)]",
          collapsible && [
            "relative isolate bg-transparent py-0 [-webkit-touch-callout:none]",
            "before:absolute before:inset-x-0 before:top-1/2 before:-z-10",
            "before:h-[calc(var(--ctl-h-sm)+var(--sp-half))] before:-translate-y-1/2",
            "before:rounded-full before:bg-[var(--fill-secondary)]",
          ],
        )}
      >
        <span
          inert={!!collapsible && !expanded}
          aria-hidden={collapsible && !expanded ? true : undefined}
          className={cn(
            "inline-flex",
            collapsible && [
              "grid overflow-hidden grid-cols-[minmax(0,0fr)] opacity-0",
              "transition-[grid-template-columns,opacity] duration-500",
              "ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            ],
            collapsible && expanded && "grid-cols-[minmax(0,1fr)] opacity-100",
          )}
        >
          <Button
            variant="gray"
            size="sm"
            className={cn([
              "min-h-[var(--ctl-h-xs)] w-11 rounded-full",
              "bg-transparent p-0 text-[var(--icon-secondary)]",
              collapsible && [
                "focus-visible:outline-offset-[calc(-1*var(--sp-2))] h-11 min-h-11 min-w-0",
                "w-11 overflow-hidden text-primary",
              ],
            ])}
            aria-label={`${label} 줄이기`}
            disabled={disabled || invalid || value <= min}
            onClick={() => change(-1)}
          >
            <Minus size={14} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </span>
        <span
          className={cn([
            "inline-flex h-[var(--ctl-h-xs)] min-w-11",
            "items-center justify-center rounded-full",
            "bg-[var(--control-selected-bg)] text-body font-semibold",
            "text-foreground shadow-control tabular-nums",
            collapsible && "h-11 bg-transparent text-body-sm shadow-none",
          ])}
          aria-live={allowDirectInput ? "polite" : undefined}
        >
          {quantityControl}
        </span>
        <span
          inert={!!collapsible && !expanded}
          aria-hidden={collapsible && !expanded ? true : undefined}
          className={cn(
            "inline-flex",
            collapsible && [
              "grid overflow-hidden grid-cols-[minmax(0,0fr)] opacity-0",
              "transition-[grid-template-columns,opacity] duration-500",
              "ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            ],
            collapsible && expanded && "grid-cols-[minmax(0,1fr)] opacity-100",
          )}
        >
          <Button
            variant="gray"
            size="sm"
            className={cn([
              "min-h-[var(--ctl-h-xs)] w-11 rounded-full",
              "bg-transparent p-0 text-[var(--icon-secondary)]",
              collapsible && [
                "focus-visible:outline-offset-[calc(-1*var(--sp-2))] h-11 min-h-11 min-w-0",
                "w-11 overflow-hidden text-primary",
              ],
            ])}
            ref={increaseRef}
            aria-label={`${label} 늘리기`}
            disabled={disabled || invalid || value >= max}
            onClick={() => change(1)}
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </span>
      </div>
      {unit && !collapsible && (
        <span className="w-[2em] shrink-0 whitespace-nowrap text-left text-caption text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
};
export default QuantityStepper;
