import type { FamilyRole } from "@/entities/family/@x/user";
export type Account = {
  userId: string | null;
  profile: { displayName: string } | null;
  membership: { familyId: string; role: FamilyRole } | null;
};
export type ProfileInput = {
  displayName: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};
