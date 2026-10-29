import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "@/shared/api";
import {
  authenticatedClient,
  getAccount,
  saveProfile,
  withdrawAccount,
} from "@/entities/user/index.server";
import {
  getFamily,
  createFamily,
  createInvite,
  previewInvite,
  acceptInvite,
  changeMemberRole,
} from "@/entities/family/index.server";
import {
  isServerMockDataEnabled,
  handleRoute,
  readJson,
  createServerSupabaseClient,
} from "@/shared/server";
import { accountRoutes, invitePath, onboardingPath } from "@/shared/config";
export function accountGET(request: Request) {
  return handleRoute(request, getAccount);
}
export function profilePOST(request: Request) {
  return handleRoute(request, async () => saveProfile(await readJson(request)));
}
export function familyGET(request: Request) {
  return handleRoute(request, async () => {
    if (!(await isServerMockDataEnabled())) await authenticatedClient();
    return getFamily();
  });
}
export function familyPOST(request: Request) {
  return handleRoute(request, async () => {
    if (!(await isServerMockDataEnabled())) await authenticatedClient();
    return createFamily(await readJson(request));
  });
}
export function invitesPOST(request: Request) {
  return handleRoute(request, async () => {
    if (!(await isServerMockDataEnabled())) await authenticatedClient();
    return createInvite();
  });
}
type InviteContext = { params: Promise<{ token: string }> };
export function inviteGET(request: Request, context: InviteContext) {
  return handleRoute(request, async () =>
    previewInvite((await context.params).token),
  );
}
export function invitePOST(request: Request, context: InviteContext) {
  return handleRoute(request, async () => {
    if (!(await isServerMockDataEnabled())) await authenticatedClient();
    return acceptInvite((await context.params).token);
  });
}
export async function authCallbackGET(request: Request) {
  const url = new URL(request.url);
  if (await isServerMockDataEnabled())
    return NextResponse.redirect(new URL(accountRoutes.onboarding, url.origin));
  const token = url.searchParams.get("invite");
  const code = url.searchParams.get("code");
  let destination = `${accountRoutes.login}?error=oauth`;
  if (code) {
    const client = await createServerSupabaseClient();
    try {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        if (!(await isServerMockDataEnabled())) await authenticatedClient();
        destination = token ? invitePath(token) : onboardingPath();
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "identity_policy_violation"
      ) {
        await client.auth.signOut();
        destination = `${accountRoutes.login}?error=identity`;
      }
    }
  }
  if (token && destination.startsWith(accountRoutes.login))
    destination += `&invite=${encodeURIComponent(token)}`;
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function withdrawPOST(request: Request) {
  return handleRoute(request, withdrawAccount);
}
export function memberRolePOST(request: Request) {
  return handleRoute(request, async () => {
    if (!(await isServerMockDataEnabled())) await authenticatedClient();
    return changeMemberRole(await readJson(request));
  });
}
