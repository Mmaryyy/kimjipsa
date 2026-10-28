import { removeCurrentPushSubscription } from "@/entities/notification";
import type { LoginProvider } from "@/entities/user";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createBrowserSupabaseClient, request } from "@/shared/api";
import {
  isMockDataEnabled,
  mockStageCookie,
  accountApiRoutes,
  accountRoutes,
} from "@/shared/config";
import type { Account, ProfileInput } from "@/entities/user";
export function fetchAccount() {
  return request<Account>(accountApiRoutes.account);
}
export function updateProfile(input: ProfileInput) {
  return request<null>(accountApiRoutes.profile, input);
}
async function clearOfflineCart() {
  if (!("serviceWorker" in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    await new Promise<void>((resolve, reject) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => {
        channel.port1.close();
        reject(
          new Error("오프라인 목록을 지우지 못했어요. 다시 시도해 주세요."),
        );
      }, 5000);
      channel.port1.onmessage = () => {
        window.clearTimeout(timeout);
        channel.port1.close();
        resolve();
      };
      controller.postMessage({ type: "CLEAR_CART_CACHE" }, [channel.port2]);
    });
  } else if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("kimjipsa-cart-"))
        .map((name) => caches.delete(name)),
    );
  }
}
export async function signOut() {
  await clearOfflineCart();
  if (isMockDataEnabled()) {
    document.cookie = `${mockStageCookie}=login; Path=/; SameSite=Lax`;
    window.location.assign(accountRoutes.login);
    return;
  }
  const client = createBrowserSupabaseClient();
  try {
    await removeCurrentPushSubscription();
  } catch {
    // Subscription cleanup must not prevent signing out, including offline.
  }
  const { error } = await client.auth.signOut();
  if (error && !isAuthSessionMissingError(error)) {
    throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
  }
}
export async function signIn(
  provider: LoginProvider,
  inviteToken?: string | null,
) {
  if (isMockDataEnabled()) {
    document.cookie = `${mockStageCookie}=profile; Path=/; SameSite=Lax`;
    window.location.assign(accountRoutes.onboarding);
    return;
  }
  const client = createBrowserSupabaseClient();
  const callback = new URL(accountRoutes.callback, window.location.origin);
  if (inviteToken) callback.searchParams.set("invite", inviteToken);
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callback.toString(),
      // Override Kakao's default scopes; options.scopes only appends to them.
      ...(provider === "kakao"
        ? { queryParams: { scope: "profile_nickname" } }
        : {}),
    },
  });
  if (error) throw new Error("로그인을 시작하지 못했어요. 다시 시도해 주세요.");
}
