"use client";
import { Minus, Plus } from "lucide-react";
import { Button } from "./button";
type QuantityStepperProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
};

export function QuantityStepper({
  label,
  value,
  onValueChange,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
}: QuantityStepperProps) {
  const invalid =
    !Number.isFinite(value) || !Number.isFinite(step) || step <= 0 || min > max;
  const change = (direction: number) => {
    // 소수 단위도 부동소수점 잔여 자릿수 없이 조절해요.
    const next = Number((value + direction * step).toFixed(10));
    onValueChange(Math.min(max, Math.max(min, next)));
  };
  return (
    <div className="kj-quantity-stepper" role="group" aria-label={label}>
      <Button
        variant="gray"
        size="sm"
        aria-label={`${label} 줄이기`}
        disabled={disabled || invalid || value <= min}
        onClick={() => change(-1)}
      >
        <Minus size={14} aria-hidden="true" />
      </Button>
      <output aria-live="polite">{value}</output>
      <Button
        variant="gray"
        size="sm"
        aria-label={`${label} 늘리기`}
        disabled={disabled || invalid || value >= max}
        onClick={() => change(1)}
      >
        <Plus size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
