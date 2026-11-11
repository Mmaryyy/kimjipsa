import * as Sentry from "@sentry/nextjs";

const errorTypes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "ApiError",
]);

const routeSegments = new Set([
  "api",
  "login",
  "onboarding",
  "restock",
  "chat",
  "invite",
  "calendar",
  "terms",
  "privacy",
  "settings",
  "lists",
  "frequent-items",
  "agent",
  "bot-type",
  "cart-category",
  "complete",
  "config",
  "context",
  "read",
  "actions",
  "attachments",
  "memories",
  "runs",
  "cancel",
  "retry",
  "saved-colors",
  "receipt-imports",
  "confirm",
  "account",
  "home-settings",
  "notification-settings",
  "profile",
  "withdraw",
  "cart",
  "cron",
  "notifications",
  "dday-dismissals",
  "event-categories",
  "delete",
  "events",
  "dismiss",
  "family",
  "member-role",
  "holidays",
  "inventory-meta",
  "inventory",
  "invites",
  "push",
  "subscriptions",
]);

export function sanitizeErrorRoute(url: string | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url, "https://localhost").pathname
      .split("/")
      .map((segment) =>
        !segment || routeSegments.has(segment) ? segment : "[id]",
      )
      .join("/");
  } catch {
    return undefined;
  }
}

// 요청·대화·DB 오류 원문 대신 코드 위치·가린 경로·환경만 허용해요.
export function sanitizeErrorEvent(
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent {
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    // sdk 를 빼면 Sentry 서버가 접속 IP로 위치를 추정해요.
    sdk: event.sdk && {
      name: event.sdk.name,
      version: event.sdk.version,
      settings: { infer_ip: "never" },
    },
    level: "error",
    tags: {
      route: sanitizeErrorRoute(
        typeof event.tags?.route === "string"
          ? event.tags.route
          : event.request?.url,
      ),
      environment: ["production", "preview"].includes(event.environment ?? "")
        ? event.environment
        : undefined,
    },
    exception: {
      values: event.exception?.values?.map((exception) => ({
        type: errorTypes.has(exception.type ?? "") ? exception.type : "Error",
        value: "Application error",
        stacktrace: {
          frames: exception.stacktrace?.frames?.map((frame) => ({
            filename: frame.filename?.match(
              /(?:\/_next\/static\/|(?:^|\/)(?:src|app)\/)[a-zA-Z0-9_./()[\]-]+\.(?:[cm]?js|tsx?)/,
            )?.[0],
            lineno: frame.lineno,
            colno: frame.colno,
            in_app: frame.in_app,
          })),
        },
      })),
    },
  };
}

export function initializeErrorMonitoring(dsn: string | undefined) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    beforeSend: sanitizeErrorEvent,
  });
}
