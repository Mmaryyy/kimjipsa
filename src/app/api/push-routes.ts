import "server-only";
import {
  hasPushSubscription,
  savePushSubscription,
  deletePushSubscription,
} from "@/entities/notification/index.server";
import { handleRoute, readJson } from "@/shared/server";
export function pushSubscriptionsPOST(request: Request) {
  return handleRoute(request, async () =>
    savePushSubscription(await readJson(request)),
  );
}
export function pushSubscriptionsPUT(request: Request) {
  return handleRoute(request, async () =>
    deletePushSubscription(await readJson(request)),
  );
}

export function pushSubscriptionsGET(request: Request) {
  return handleRoute(request, () =>
    hasPushSubscription(new URL(request.url).searchParams.get("endpoint")),
  );
}
