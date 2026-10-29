import { useRef, useState } from "react";
import { roles, type Family } from "@/entities/family";
import { useChangeMemberRole } from "@/features/family";
import { SegmentedControl, Sheet, Text, TextButton } from "@/shared/ui";

interface Props {
  member: Family["members"][number];
  isLastAdmin: boolean;
  canEdit: boolean;
  onSaved: (message: string) => void;
  onFocusList: () => void;
}

const MemberRoleSettings = ({
  member,
  isLastAdmin,
  canEdit,
  onSaved,
  onFocusList,
}: Props) => {
  const [open, setOpen] = useState(false);
  const saved = useRef(false);
  const selectedRole = useRef(member.role);
  const mutation = useChangeMemberRole(() => {
    saved.current = true;
    setOpen(false);
    const suffix = selectedRole.current === "member" ? "으로" : "로";
    onSaved(`${roles[selectedRole.current]}${suffix} 지정했어요.`);
  });
  const guidance = isLastAdmin
    ? "마지막 관리자는 먼저 다른 구성원을 관리자로 지정해야 역할을 바꿀 수 있어요."
    : "역할을 선택하면 바로 저장돼요. 다른 관리자의 역할은 본인만 바꿀 수 있어요.";
  const options = Object.entries(roles).map(([value, label]) => ({
    value: value as keyof typeof roles,
    label,
    disabled: isLastAdmin && value !== "admin",
  }));

  return (
    <Sheet
      showCloseButton
      open={open}
      onOpenChange={(nextOpen) => {
        if (mutation.isPending) return;
        saved.current = false;
        setOpen(nextOpen);
        mutation.reset();
      }}
      title={`${member.display_name} 님 역할`}
      description="관리자는 구성원의 역할을 바꿀 수 있어요."
      onCloseAutoFocus={(event) => {
        if (saved.current) {
          event.preventDefault();
          onFocusList();
        }
      }}
      trigger={
        canEdit ? (
          <TextButton aria-label={`${member.display_name} 님 역할 변경`}>
            역할 변경
          </TextButton>
        ) : undefined
      }
    >
      <div className="space-y-4 py-4" aria-busy={mutation.isPending}>
        <SegmentedControl
          label="구성원 역할"
          options={options}
          value={member.role}
          disabled={mutation.isPending}
          onValueChange={(role) => {
            if (role !== member.role) {
              selectedRole.current = role;
              mutation.mutate({ memberId: member.user_id, role });
            }
          }}
        />
        <Text as="p" variant="body-sm" className="text-muted-foreground">
          {guidance}
        </Text>
        {mutation.isPending && <Text role="status">저장하고 있어요.</Text>}
        {mutation.error && (
          <Text as="p" role="alert" className="text-error-text">
            {mutation.error.message}
          </Text>
        )}
      </div>
    </Sheet>
  );
};

export default MemberRoleSettings;
