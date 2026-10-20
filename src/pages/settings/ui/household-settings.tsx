"use client";
import { SettingsSkeleton } from "./settings-skeleton";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEventCategories } from "@/entities/event";
import { eventRoutes } from "@/shared/config";
import { CategoryDot, ErrorState, GroupLabel, Text } from "@/shared/ui";

export function HouseholdSettings() {
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
  if (categories.isPending)
    return (
      <SettingsSkeleton
        label="일정 카테고리를 불러오고 있어요"
        title="가정"
        rows={5}
      />
    );
  return (
    <section data-od-id="set-household">
      <GroupLabel>가정</GroupLabel>
      <Link
        href={eventRoutes.categories}
        data-od-id="s-cal-categories"
        className="flex min-h-11 items-center justify-between gap-3"
      >
        <span>일정 카테고리</span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="flex gap-1">
            {categories.data.slice(0, 5).map((category) => (
              <CategoryDot key={category.id} color={category.color} />
            ))}
          </span>
          <Text variant="body-sm">{categories.data.length}개</Text>
          <ChevronRight size={16} className="text-[var(--icon-tertiary)]" />
        </span>
      </Link>
      {[
        { label: "재고 카테고리", odId: "s-inv-categories" },
        { label: "보관 장소", odId: "s-locations" },
        { label: "단위", odId: "s-units" },
        { label: "유통기한 임박 기준", odId: "s-expiry-days" },
      ].map(({ label, odId }) => (
        <div
          key={odId}
          data-od-id={odId}
          className="flex min-h-11 items-center justify-between gap-3"
        >
          <span>{label}</span>
          <Text variant="caption" className="text-muted-foreground">
            준비 중
          </Text>
        </div>
      ))}
    </section>
  );
}
