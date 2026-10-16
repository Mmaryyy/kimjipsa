export const accountRoutes = {
  login: "/login",
  callback: "/auth/callback",
  onboarding: "/onboarding",
  family: "/family",
  invite: "/invite",
  home: "/",
  terms: "/terms",
  privacy: "/privacy",
} as const;
export const accountApiRoutes = {
  account: "/api/account",
  profile: "/api/account/profile",
  family: "/api/family",
  invites: "/api/invites",
} as const;
export function invitePath(token: string) {
  return `${accountRoutes.invite}/${encodeURIComponent(token)}`;
}
export function inviteApiPath(token: string) {
  return `${accountApiRoutes.invites}/${encodeURIComponent(token)}`;
}
export function onboardingPath(token?: string | null) {
  return token
    ? `${accountRoutes.onboarding}?invite=${encodeURIComponent(token)}`
    : accountRoutes.onboarding;
}
