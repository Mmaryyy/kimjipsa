"use client";
import { ErrorState } from "@/shared/ui";
export function RouteError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="화면을 불러오지 못했어요. 다시 시도해 주세요."
      onRetry={reset}
    />
  );
}
