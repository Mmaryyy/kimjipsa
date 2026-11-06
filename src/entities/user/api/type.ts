import type { FamilyRole } from "@/entities/family/@x/user";
import type { LoginProvider } from "../model/providers.constants";
import type { BotType } from "../model/bot-character.constants";
export type Account = {
  botType?: BotType;
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
