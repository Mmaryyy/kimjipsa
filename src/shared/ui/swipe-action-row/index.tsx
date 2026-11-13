"use client";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/shared/lib";

interface Props extends Omit<ComponentProps<"li">, "children" | "onChange"> {
  label: string;
  actions: ReactNode[];
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  inertContent?: boolean;
  contentClassName?: string;
  actionsClassName?: string;
  children: (disabled: boolean) => ReactNode;
}
const SwipeActionRow = ({
  label,
  actions,
  disabled = false,
  open,
  onOpenChange,
  inertContent = true,
  contentClassName,
  actionsClassName,
  className,
  children,
  ...props
}: Props) => {
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = open ?? localOpen;
  const root = useRef<HTMLLIElement>(null);
  const actionArea = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const onOpenChangeRef = useRef(onOpenChange);
  useLayoutEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  useLayoutEffect(() => {
    if (!isOpen && actionArea.current?.contains(document.activeElement))
      root.current?.focus();
  }, [isOpen]);
  const setOpen = useCallback((next: boolean) => {
    setLocalOpen(next);
    if (!next && actionArea.current?.contains(document.activeElement))
      root.current?.focus();
    onOpenChangeRef.current?.(next);
  }, []);
  const actionWidth = actions.length * 48;
  const [offset, setOffset] = useState<number | null>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    base: number;
    horizontal: boolean;
  } | null>(null);
  const dragged = useRef(false);
  const revealedWidth = -(offset ?? (isOpen ? -actionWidth : 0));
  const finishSwipe = (cancelled: boolean) => {
    if (!gesture.current) return;
    if (gesture.current.horizontal) setOpen(!cancelled && (offset ?? 0) < -60);
    gesture.current = null;
    setOffset(null);
  };
  useEffect(() => {
    if (!isOpen) return;
    const close = () => {
      gesture.current = null;
      setOffset(null);
      setOpen(false);
    };
    const outside = (event: Event) => {
      if (
        !(event.target instanceof Node) ||
        !root.current?.contains(event.target)
      )
        close();
    };
    const otherRow = (event: Event) => {
      if (event instanceof CustomEvent && event.detail !== root.current)
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", escape);
    document.addEventListener("swipe-row-open", otherRow);
    document.dispatchEvent(
      new CustomEvent("swipe-row-open", { detail: root.current }),
    );
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("swipe-row-open", otherRow);
    };
  }, [isOpen, setOpen]);
  return (
    <li
      {...props}
      ref={root}
      data-swipe-row
      className={cn("relative overflow-clip", className)}
      tabIndex={disabled ? undefined : 0}
      aria-describedby={disabled ? undefined : hintId}
      onKeyDown={(event) => {
        if (disabled || event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          setOpen(event.key === "ArrowLeft");
        }
      }}
      onPointerDown={(event) => {
        dragged.current = false;
        if (
          disabled ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target instanceof Element &&
            event.target.closest('[role="group"], [data-swipe-actions]'))
        )
          return;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          base: isOpen ? -actionWidth : 0,
          horizontal: false,
        };
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!start.horizontal) {
          if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
          start.horizontal = true;
          dragged.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          setOpen(true);
        }
        setOffset(Math.max(-actionWidth, Math.min(0, start.base + dx)));
      }}
      onPointerUp={() => finishSwipe(false)}
      onPointerCancel={() => finishSwipe(true)}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget) finishSwipe(true);
      }}
      onClickCapture={(event) => {
        if (dragged.current) {
          event.preventDefault();
          event.stopPropagation();
          dragged.current = false;
        }
      }}
    >
      <span id={hintId} className="sr-only">
        왼쪽 화살표 키로 동작 열기, 오른쪽 화살표 키나 Escape로 닫기
      </span>
      <div
        ref={actionArea}
        onClickCapture={() => {
          // 확인창이 닫힌 동작 버튼 대신 행으로 포커스를 되돌리게 해요.
          if (actionArea.current?.contains(document.activeElement))
            root.current?.focus();
        }}
        role="group"
        aria-label={label}
        className={cn(
          "absolute top-0 right-0 bottom-0 z-10 flex items-center gap-4 px-2",
          "transition-transform motion-reduce:transition-none",
          actionsClassName,
        )}
        style={{
          width: actionWidth,
          transform: `translateX(${actionWidth - revealedWidth}px)`,
          transitionDuration: offset === null ? undefined : "0ms",
        }}
        data-swipe-actions
        inert={!isOpen || disabled}
        aria-hidden={!isOpen}
      >
        {actions}
      </div>
      <div
        data-swipe-content
        className={cn(
          "relative touch-pan-y bg-background transition-[padding] duration-150 motion-reduce:transition-none",
          contentClassName,
        )}
        style={{
          paddingRight: revealedWidth,
          transitionDuration: offset === null ? undefined : "0ms",
        }}
        inert={inertContent && isOpen}
      >
        {children(disabled || isOpen)}
      </div>
    </li>
  );
};
export default SwipeActionRow;
