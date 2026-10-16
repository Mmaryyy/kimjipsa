export const providers = ["kakao", "google"] as const;
export type LoginProvider = (typeof providers)[number];
