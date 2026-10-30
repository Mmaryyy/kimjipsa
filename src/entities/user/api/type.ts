import type { FamilyRole } from "@/entities/family/@x/user";
import type { LoginProvider } from "../model/providers.constants";
export type Account = {
  loginProvider?: LoginProvider;
  userId: string | null;
  profile: { displayName: string; termsVersion: string | null } | null;
  membership: { familyId: string; role: FamilyRole } | null;
};
export type ProfileInput = {
  displayName: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};
