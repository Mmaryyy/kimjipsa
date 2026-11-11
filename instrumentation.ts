import { captureRequestError } from "@sentry/nextjs";

export async function register() {
  const { initializeErrorMonitoring } =
    await import("@/shared/lib/error-monitoring");
  initializeErrorMonitoring(process.env.NEXT_PUBLIC_SENTRY_DSN);
}

export const onRequestError = captureRequestError;
