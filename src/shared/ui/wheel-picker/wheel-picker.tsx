"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";
import * as WheelPickerPrimitive from "@ncdai/react-wheel-picker";
import "@ncdai/react-wheel-picker/style.css";
import { cn, useMediaQuery } from "@/shared/lib";

export function WheelPickerWrapper({
  className,
  ...props
}: ComponentProps<typeof WheelPickerPrimitive.WheelPickerWrapper>) {
  return (
    <WheelPickerPrimitive.WheelPickerWrapper
      className={cn("touch-none overscroll-contain", className)}
      {...props}
    />
  );
}

export function WheelPicker({
  label,
  className,
  classNames,
  ...props
}: ComponentProps<typeof WheelPickerPrimitive.WheelPicker<string>> & {
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const index = props.options.findIndex(
    (option) => option.value === props.value,
  );
  const selected = props.options[index];

  // 1.2.3은 ARIA props를 전달하지 않아서 실제 키보드 포커스 대상에 붙인다.
  useLayoutEffect(() => {
    const wheel = ref.current?.querySelector("[data-rwp]");
    if (!wheel) return;
    wheel.setAttribute("role", "spinbutton");
    wheel.setAttribute("aria-label", label);
    wheel.setAttribute("aria-valuemin", "0");
    wheel.setAttribute("aria-valuemax", String(props.options.length - 1));
    wheel.setAttribute("aria-valuenow", String(Math.max(index, 0)));
    wheel.setAttribute(
      "aria-valuetext",
      selected?.textValue ?? String(selected?.label ?? ""),
    );
  }, [label, index, selected, props.options.length]);

  return (
    <div
      ref={ref}
      onKeyDownCapture={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        // 1.2.3의 키보드 핸들러는 제어 값의 초기 콜백을 붙잡아 되돌리기를 놓친다.
        // 현재 props로 이동해 같은 값으로 돌아와도 적용되게 한다.
        event.preventDefault();
        event.stopPropagation();
        const step = event.key === "ArrowDown" ? 1 : -1;
        let next = index;
        for (let count = 0; count < props.options.length; count += 1) {
          next += step;
          if (props.infinite)
            next = (next + props.options.length) % props.options.length;
          const option = props.options[next];
          if (!option) return;
          if (!option.disabled) {
            props.onValueChange?.(option.value);
            return;
          }
        }
      }}
      className={cn(
        "min-w-0 flex-1 [&_[data-rwp]:focus-visible]:bg-accent",
        className,
      )}
    >
      <WheelPickerPrimitive.WheelPicker
        {...props}
        visibleCount={20}
        optionItemHeight={34}
        dragSensitivity={reducedMotion ? 1000 : 3}
        scrollSensitivity={reducedMotion ? 100000 : 5}
        classNames={{
          optionItem: cn(
            "text-muted-foreground text-title-sm!",
            classNames?.optionItem,
          ),
          highlightWrapper: cn("bg-transparent", classNames?.highlightWrapper),
          highlightItem: cn(
            "text-foreground text-title-sm!",
            classNames?.highlightItem,
          ),
        }}
      />
    </div>
  );
}
