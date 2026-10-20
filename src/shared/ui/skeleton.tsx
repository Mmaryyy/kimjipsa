"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/shared/lib";

const LoadingContext = createContext<(() => () => void) | null>(null);

export function SkeletonStatus({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState(0);
  const register = useCallback(() => {
    setSections((count) => count + 1);
    return () => setSections((count) => count - 1);
  }, []);
  return (
    <LoadingContext value={register}>
      <span
        role={sections > 0 ? "status" : undefined}
        aria-live="polite"
        className="sr-only"
        aria-atomic="true"
      >
        {sections > 0 ? "화면을 불러오고 있어요" : ""}
      </span>
      {children}
    </LoadingContext>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block rounded-[var(--sp-half)] bg-[var(--fill-quaternary)]",
        "animate-skeleton-pulse motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const register = useContext(LoadingContext);
  useEffect(() => register?.(), [register]);
  return (
    <div role="group" aria-label={label} aria-busy="true">
      {children}
    </div>
  );
}
