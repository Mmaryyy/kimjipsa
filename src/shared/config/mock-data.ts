export const mockEnabledCookie = "kimjipsa-mock-enabled";
export const mockSessionCookie = "kimjipsa-mock-session";
export const mockPerspectiveCookie = "kimjipsa-mock-perspective";
export const mockConsentResetCookie = "kimjipsa-mock-consent-reset";
export const mockStageCookie = "kimjipsa-mock-stage";

// Servers pass the request cookie explicitly; browsers read their own cookie.
export function isMockDataEnabled(cookieValue?: string) {
  if (process.env.NODE_ENV !== "development") return false;
  if (cookieValue !== undefined) return cookieValue === "1";
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${mockEnabledCookie}=1`);
}
