"use client";

import type { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { cn, usePullToAdd } from "@/shared/lib";

interface Props {
  action: string;
  onAdd: () => void;
  disabled?: boolean;
  children: ReactNode;
}

const PullToAdd = ({ action, onAdd, disabled, children }: Props) => {
  const { ref, distance, ready } = usePullToAdd(onAdd, disabled);
  const offset = Math.min(distance * 0.35, 48);
  return (
    <div ref={ref} className="relative overscroll-y-none">
      {distance > 0 && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-0 top-[max(var(--sp-8),calc(env(safe-area-inset-top)+var(--sp-2)))] z-10 flex justify-center text-caption text-muted-foreground"
        >
          <span className="flex items-center gap-1 rounded-full bg-background px-2">
            <ArrowDown
              aria-hidden
              className={cn(
                "size-4 transition-transform motion-reduce:transition-none",
                ready && "rotate-180",
              )}
            />
            {`당겨서 ${action}`}
          </span>
        </p>
      )}
      {/* 고정된 하단 동작의 기준을 유지하려고 transform 대신 top으로 옮겨요. */}
      <div
        className={
          distance > 0
            ? "relative top-[var(--pull-offset)] motion-reduce:top-0"
            : undefined
        }
        style={{ "--pull-offset": `${offset}px` } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
};
export default PullToAdd;
