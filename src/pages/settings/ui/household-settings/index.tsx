"use client";

import { CategoryDot, ErrorState, GroupLabel, Text } from "@/shared/ui";

import { ChevronRight } from "lucide-react";
import InventorySettings from "../inventory-settings";
import HouseholdSettingsSkeleton from "./Skeleton";
import SettingsRow from "../settings-row";
import { eventRoutes } from "@/shared/config";
import { useEventCategories } from "@/entities/event";

const HouseholdSettings = () => {
  const categories = useEventCategories();

  if (categories.isError)
    return (
      <ErrorState
        message={categories.error.message}
        onRetry={() => {
          void categories.refetch();
        }}
      />
    );

  if (categories.isPending) return <HouseholdSettingsSkeleton />;

  return (
    <section data-od-id="set-household">
      <GroupLabel>가정</GroupLabel>
      <SettingsRow
        label="일정 카테고리"
        odId="s-cal-categories"
        href={eventRoutes.categories}
        action={
          <span className="flex items-center gap-2">
            <span className="flex gap-1">
              {categories.data.slice(0, 5).map((category) => (
                <CategoryDot key={category.id} color={category.color} />
              ))}
            </span>
            <Text variant="body-sm" className="text-muted-foreground">
              {categories.data.length}개
            </Text>
            <ChevronRight size={16} className="text-[var(--icon-tertiary)]" />
          </span>
        }
      />
      <InventorySettings />
    </section>
  );
};

export default HouseholdSettings;
