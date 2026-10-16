export const roles = {
  admin: "관리자",
  member: "구성원",
  child: "자녀",
} as const;
export type FamilyRole = keyof typeof roles;
