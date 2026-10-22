"use client";

import { ErrorState, GroupLabel } from "@/shared/ui";

import HomeSettingsForm from "./Form";
import HomeSettingsSkeleton from "./Skeleton";
import { useHomeSettings } from "@/entities/user";

const HomeSettingsContent = () => {
  const settings = useHomeSettings();

  if (settings.isError)
    return (
      <ErrorState
        message={settings.error.message}
        onRetry={() => {
          void settings.refetch();
        }}
      />
    );
  if (settings.isPending) return <HomeSettingsSkeleton />;
  return <HomeSettingsForm settings={settings.data} />;
};

const HomeSettings = () => {
  return (
    <section data-od-id="set-home" aria-labelledby="home-settings-title">
      <GroupLabel id="home-settings-title">홈 화면</GroupLabel>
      <HomeSettingsContent />
    </section>
  );
};

export default HomeSettings;
