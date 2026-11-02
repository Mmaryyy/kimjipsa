"use client";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/shared/lib";
import { Button } from "../button";
import { Input } from "../input";
import { TextButton } from "../text-button";

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
  useEffect(() => {
    if (!expanded || !onOpenChange) return;
    const close = () => {
      flushSync(() => onOpenChange(false));
      collapsedRef.current?.focus();
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      editing.current = false;
      close();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [expanded, onOpenChange]);
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
    <span className="text-caption font-normal text-muted-foreground">
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
  if (allowDirectInput) {
    quantityControl =
      draft === null ? (
        <TextButton
          className={cn(
            "min-h-[var(--ctl-h-xs)] min-w-11 w-full px-1 text-body font-semibold text-foreground tabular-nums",
            collapsible && "h-11 gap-0 text-body-sm",
          )}
          aria-label={`${label} 수량 직접 입력`}
          disabled={disabled || invalid}
          onClick={() => {
            editing.current = true;
            setDraft(String(value));
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
      {collapsible && (
        <TextButton
          ref={collapsedRef}
          hidden={expanded}
          aria-expanded={expanded}
          aria-label={`${label} 수량 ${value}${unit ?? ""}, 눌러서 바꾸기`}
          disabled={disabled || invalid}
          className={cn(
            "relative min-h-11 min-w-11 gap-0 px-3 text-body-sm font-semibold text-foreground tabular-nums",
            "before:absolute before:inset-x-0 before:top-1/2 before:-z-10 before:h-[calc(var(--ctl-h-sm)+var(--sp-half))]",
            "isolate before:-translate-y-1/2 before:rounded-full before:bg-[var(--fill-secondary)]",
            expanded && "hidden",
          )}
          onClick={() => {
            editing.current = false;
            setDraft(null);
            collapsible.onOpenChange(true);
          }}
        >
          {quantityLabel}
        </TextButton>
      )}
      <div
        hidden={!!collapsible && !expanded}
        className={cn(
          "inline-flex items-center rounded-full bg-sys-gray5 py-[calc((var(--hit)-var(--ctl-h-xs))/2)]",
          collapsible && [
            "relative isolate bg-transparent py-0",
            "before:absolute before:inset-x-0 before:top-1/2 before:-z-10",
            "before:h-[calc(var(--ctl-h-sm)+var(--sp-half))] before:-translate-y-1/2",
            "before:rounded-full before:bg-[var(--fill-secondary)]",
          ],
          collapsible && !expanded && "hidden",
        )}
      >
        <Button
          variant="gray"
          size="sm"
          className={cn([
            "min-h-[var(--ctl-h-xs)] w-11 rounded-full",
            "bg-transparent p-0 text-[var(--icon-secondary)]",
            collapsible && "h-11 min-h-11 text-primary",
          ])}
          aria-label={`${label} 줄이기`}
          disabled={disabled || invalid || value <= min}
          onClick={() => change(-1)}
        >
          <Minus size={14} strokeWidth={1.5} aria-hidden="true" />
        </Button>
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
        <Button
          variant="gray"
          size="sm"
          className={cn([
            "min-h-[var(--ctl-h-xs)] w-11 rounded-full",
            "bg-transparent p-0 text-[var(--icon-secondary)]",
            collapsible && "h-11 min-h-11 text-primary",
          ])}
          ref={increaseRef}
          aria-label={`${label} 늘리기`}
          disabled={disabled || invalid || value >= max}
          onClick={() => change(1)}
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
        </Button>
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
