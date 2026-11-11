import { initializeErrorMonitoring } from "@/shared/lib/error-monitoring";

initializeErrorMonitoring(process.env.NEXT_PUBLIC_SENTRY_DSN);
