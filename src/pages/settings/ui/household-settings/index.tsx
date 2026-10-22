"use client";

import { CategoryDot, ErrorState, GroupLabel, Text } from "@/shared/ui";

import { ChevronRight } from "lucide-react";
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
      {[
        { label: "재고 카테고리", odId: "s-inv-categories" },
        { label: "보관 장소", odId: "s-locations" },
        { label: "단위", odId: "s-units" },
        { label: "유통기한 임박 기준", odId: "s-expiry-days" },
      ].map(({ label, odId }) => (
        <SettingsRow
          key={odId}
          label={label}
          odId={odId}
          action={
            <Text variant="caption" className="text-muted-foreground">
              준비 중
            </Text>
          }
        />
      ))}
    </section>
  );
};

export default HouseholdSettings;
