import { useRef, useState } from "react";
import { GroupLabel, List, ListRow, Text } from "@/shared/ui";

import { FamilyRoleIcon, type Family } from "@/entities/family";
import type { Account } from "@/entities/user";
import { InviteShare } from "@/features/family";
import MemberRoleSettings from "./MemberRole";
import { cn } from "@/shared/lib";

interface Props {
  account: Account;
  family: Family;
}

const MemberSettings = ({ account, family }: Props) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const isAdmin = account.membership?.role === "admin";
  const adminCount = family.members.filter(
    (member) => member.role === "admin",
  ).length;
  return (
    <section data-od-id="set-members">
      <GroupLabel ref={titleRef} tabIndex={-1}>
        {family.name} 구성원
      </GroupLabel>
      <Text as="p" role="status" variant="caption">
        {message}
      </Text>
      <List>
        {family.members.map((member) => {
          const isMe = member.user_id === account.userId;
          return (
            <ListRow
              key={member.user_id}
              data-od-id={isMe ? "member-me" : "member-partner"}
              trailing={
                <MemberRoleSettings
                  canEdit={isAdmin && (member.role !== "admin" || isMe)}
                  onSaved={setMessage}
                  onFocusList={() => titleRef.current?.focus()}
                  member={member}
                  isLastAdmin={member.role === "admin" && adminCount === 1}
                />
              }
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
