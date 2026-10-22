import { GroupLabel, Sheet, Text, TextButton } from "@/shared/ui";
import { providerOptions, type Account } from "@/entities/user";

import { ProfileForm } from "@/features/account";
import SettingsRow from "../settings-row";
import { getOptionLabel } from "@/shared/lib";
import { useState } from "react";

interface Props {
  profile: Account["profile"];
  loginProvider: Account["loginProvider"];
}

const ProfileSettings = ({ profile, loginProvider }: Props) => {
  const [editingName, setEditingName] = useState(false);
  return (
    <section data-od-id="set-profile">
      <GroupLabel>내 정보</GroupLabel>
      <Sheet
        showCloseButton
        open={editingName}
        onOpenChange={setEditingName}
        title="표시 이름 수정"
        description="표시 이름은 6자 이하로 입력해 주세요."
        trigger={
          <TextButton
            data-od-id="s-display-name"
            className="flex min-h-11 w-full justify-between text-body font-normal text-foreground"
          >
            <span>표시 이름</span>
            <Text variant="body-sm" className="text-muted-foreground">
              {profile?.displayName}
            </Text>
          </TextButton>
        }
      >
        <ProfileForm
          autoFocus
          displayName={profile?.displayName}
          onSaved={() => setEditingName(false)}
        />
      </Sheet>
      <SettingsRow
        label="로그인"
        action={
          <Text variant="body-sm" className="text-muted-foreground">
            {getOptionLabel(
              loginProvider,
              providerOptions,
              "로그인 수단을 확인할 수 없어요",
            )}
          </Text>
        }
      />
    </section>
  );
};

export default ProfileSettings;
