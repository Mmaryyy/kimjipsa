import type { FamilyRole } from "../model/roles.constants";
export type Family = {
  id: string;
  name: string;
  members: { user_id: string; display_name: string; role: FamilyRole }[];
};
export type Invitation = { token: string; expiresAt: string };
export type InvitePreview =
  | { status: "valid"; familyName: string }
  | { status: "used" | "expired" | "not_found" };
