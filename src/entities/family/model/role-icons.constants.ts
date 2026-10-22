import { Baby, BicepsFlexed, type LucideIcon } from "lucide-react";
import type { FamilyRole } from "./roles.constants";

export const roleIcons = {
  admin: BicepsFlexed,
  member: null,
  child: Baby,
} satisfies Record<FamilyRole, LucideIcon | null>;
