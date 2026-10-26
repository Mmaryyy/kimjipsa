"use client";
import { useId, useRef, useState } from "react";
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
}: Props) => {
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = useRef(false);
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
  const quantity = (
    <>
      {value}
      {unit && (
        <span className="ml-1 text-caption font-normal text-muted-foreground">
          {unit}
        </span>
      )}
    </>
  );
  let quantityControl = <output aria-live="polite">{quantity}</output>;
  if (allowDirectInput) {
    quantityControl =
      draft === null ? (
        <TextButton
          className="min-w-[var(--ctl-h)] text-body font-semibold text-foreground tabular-nums"
          aria-label={`${label} 수량 직접 입력`}
          disabled={disabled || invalid}
          onClick={() => {
            editing.current = true;
            setDraft(String(value));
          }}
        >
          {quantity}
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
            className="min-h-[var(--ctl-h-xs)] w-16 px-1 py-0 text-center font-semibold tabular-nums"
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
        </>
      );
  }
  return (
    <div
      className={cn([
        "inline-flex items-center gap-0.5 [&_button]:min-h-[var(--ctl-h-xs)]",
        "[&_output]:min-w-[var(--ctl-h)] [&_output]:text-center",
        "[&_output]:font-semibold [&_output]:tabular-nums",
      ])}
      role="group"
      aria-label={label}
    >
      <Button
        variant="gray"
        size="sm"
        className="w-[var(--ctl-h-xs)] p-0"
        aria-label={`${label} 줄이기`}
        disabled={disabled || invalid || value <= min}
        onClick={() => change(-1)}
      >
        <Minus size={14} aria-hidden="true" />
      </Button>
      {quantityControl}
      <Button
        variant="gray"
        size="sm"
        className="w-[var(--ctl-h-xs)] p-0"
        aria-label={`${label} 늘리기`}
        disabled={disabled || invalid || value >= max}
        onClick={() => change(1)}
      >
        <Plus size={14} aria-hidden="true" />
      </Button>
    </div>
  );
};
export default QuantityStepper;
