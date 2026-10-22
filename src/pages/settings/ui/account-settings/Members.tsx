import { GroupLabel, List, ListRow } from "@/shared/ui";

import { FamilyRoleIcon, type Family } from "@/entities/family";
import type { Account } from "@/entities/user";
import { InviteShare } from "@/features/family";
import { cn } from "@/shared/lib";

interface Props {
  account: Account;
  family: Family;
}

const MemberSettings = ({ account, family }: Props) => {
  return (
    <section data-od-id="set-members">
      <GroupLabel>{family.name} 구성원</GroupLabel>
      <List>
        {family.members.map((member) => {
          const isMe = member.user_id === account.userId;
          return (
            <ListRow
              key={member.user_id}
              data-od-id={isMe ? "member-me" : "member-partner"}
              leading={
                <span
                  className={cn([
                    "grid size-8 place-items-center rounded-[var(--r-round)] bg-muted",
                    "text-[length:var(--type-caption-size)] font-semibold text-muted-foreground",
                  ])}
                >
                  {Array.from(member.display_name)[0]}
                </span>
              }
            >
              <span className="whitespace-nowrap">
                {member.display_name}
                {isMe && " (나)"}
                {member.role !== "member" && (
                  <>
                    {" "}
                    <FamilyRoleIcon role={member.role} />
                  </>
                )}
              </span>
            </ListRow>
          );
        })}
      </List>
      {account.membership?.role === "admin" && <InviteShare />}
    </section>
  );
};

export default MemberSettings;
