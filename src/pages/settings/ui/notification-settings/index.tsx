"use client";

import { ErrorState, GroupLabel } from "@/shared/ui";

import NotificationSettingsForm from "./Form";
import NotificationSettingsSkeleton from "./Skeleton";
import { useNotificationSettings } from "@/entities/user";

const NotificationSettingsContent = () => {
  const settings = useNotificationSettings();

  if (settings.isError)
    return (
      <ErrorState
        message={settings.error.message}
        onRetry={() => {
          void settings.refetch();
        }}
      />
    );
  if (settings.isPending) return <NotificationSettingsSkeleton />;
  return <NotificationSettingsForm settings={settings.data} />;
};

const NotificationSettings = () => {
  return (
    <section
      data-od-id="set-notify"
      aria-labelledby="notification-settings-title"
    >
      <GroupLabel id="notification-settings-title">알림</GroupLabel>
      <NotificationSettingsContent />
    </section>
  );
};

export default NotificationSettings;
