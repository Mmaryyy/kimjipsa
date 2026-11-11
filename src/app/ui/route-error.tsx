"use client";
import { ErrorState } from "@/shared/ui";
import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);
  return (
    <ErrorState
      message="화면을 불러오지 못했어요. 다시 시도해 주세요."
      onRetry={reset}
    />
  );
}
