import { request } from "@/shared/api";
import { pushSubscriptionsApiPath } from "@/shared/config";

export async function removeCurrentPushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  // Authentication must still exist when deleting the server's subscription.
  try {
    await request(
      pushSubscriptionsApiPath,
      { endpoint: subscription.endpoint },
      "PUT",
    );
  } finally {
    // A failed server deletion must still revoke this device subscription.
    await subscription.unsubscribe();
  }
}
