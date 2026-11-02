import { roleIcons } from "../model/role-icons.constants";
import { roles, type FamilyRole } from "../model/roles.constants";

export function FamilyRoleIcon({ role }: { role: FamilyRole }) {
  const Icon = roleIcons[role];
  if (!Icon) return null;

  return (
    <Icon
      role="img"
      aria-label={roles[role]}
      aria-hidden={false}
      className="inline-block size-[1em] shrink-0 align-[-0.125em] text-[var(--icon-secondary)] scale-x-[-1]"
    />
  );
}
