import { request } from "@/shared/api";
import { pushSubscriptionsApiPath } from "@/shared/config";

function pushManager() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  if (ios && !standalone)
    throw new Error(
      "Safari 공유 메뉴에서 ‘홈 화면에 추가’한 뒤 앱에서 알림을 켜 주세요.",
    );
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    throw new Error("이 브라우저에서는 웹 푸시를 지원하지 않아요.");
}
function applicationKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    (letter) => letter.charCodeAt(0),
  );
}
export async function enableWebPush() {
  pushManager();
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key)
    throw new Error(
      "웹 푸시 연결을 준비 중이에요. 잠시 후 다시 시도해 주세요.",
    );
  // Request directly in the switch gesture, before waiting for the worker.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "알림 권한이 차단되어 있어요. 브라우저 설정에서 알림을 허용해 주세요."
        : "알림 권한을 허용해야 웹 푸시를 받을 수 있어요.",
    );
  await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationKey(key),
    }));
  await request(pushSubscriptionsApiPath, subscription.toJSON());
}
export async function hasWebPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription || Notification.permission !== "granted") return false;
  return request<boolean>(
    `${pushSubscriptionsApiPath}?endpoint=${encodeURIComponent(subscription.endpoint)}`,
  );
}
