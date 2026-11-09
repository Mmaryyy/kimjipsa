"use client";
import { useState } from "react";
import { categoryColorHex, cn, type CategoryColor } from "@/shared/lib";
import { eventCategoryColors, useSavedCategoryColors } from "@/entities/event";
import { CategoryDot, ErrorState } from "@/shared/ui";

import EventCategoryCustomColorPicker from "./CustomColorPicker";

interface Props {
  color: CategoryColor;
  onChange: (color: CategoryColor) => void;
}

const EventCategoryColorPicker = ({ color, onChange }: Props) => {
  const saved = useSavedCategoryColors();
  const [customColor, setCustomColor] = useState(
    color.startsWith("#") ? color : undefined,
  );
  const presets = Object.entries(eventCategoryColors);
  const visibleSaved = (saved.data ?? []).slice(0, 7);
  const customSelected =
    !saved.isPending && color.startsWith("#") && !visibleSaved.includes(color);
  const options = [
    ...presets.map(([value, label]) => ({
      value: value as CategoryColor,
      label,
    })),
    ...visibleSaved.map((value) => ({ value, label: `저장한 색 ${value}` })),
  ];
  return (
    <>
      <div className="grid grid-cols-7 gap-2 pt-2 pb-1 md:flex md:flex-wrap md:gap-2">
        {options.map(({ value, label }) => (
          <label
            key={value}
            className={cn(
              "relative grid size-9 place-items-center [&_input]:absolute [&_input]:inset-0",
              "[&_input]:cursor-pointer [&_input]:opacity-0",
              "[&_[data-slot=category-dot]]:pointer-events-none [&_[data-slot=category-dot]]:size-6.5",
              "[&:has(input:checked)_[data-slot=category-dot]]:outline-2",
              "[&:has(input:checked)_[data-slot=category-dot]]:outline-primary",
              "[&:has(input:checked)_[data-slot=category-dot]]:outline-offset-4",
              "[&:has(input:checked)_[data-slot=category-dot]]:scale-[var(--swatch-selected-scale)]",
              "has-[:focus-visible]:rounded-[var(--r-round)] has-[:focus-visible]:outline-2",
              "has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2",
            )}
          >
            <input
              type="radio"
              name="color"
              value={value}
              checked={color === value}
              onChange={() => onChange(value)}
              aria-label={label}
            />
            <CategoryDot color={value} />
          </label>
        ))}
        <div className="relative size-9">
          <input
            type="radio"
            name="color"
            value={customSelected ? color : (customColor ?? "")}
            checked={customSelected}
            onChange={() => {
              if (customColor) onChange(customColor);
            }}
            onKeyDown={(event) => {
              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.parentElement
                  ?.querySelector("button")
                  ?.click();
              }
            }}
            aria-label="직접 선택 색"
            className="peer sr-only"
          />
          <EventCategoryCustomColorPicker
            initialColor={
              customColor ??
              (color.startsWith("#")
                ? color
                : categoryColorHex[color as keyof typeof categoryColorHex]) ??
              Object.values(categoryColorHex)[0]
            }
            selected={customSelected}
            color={color}
            onConfirm={(value) => {
              setCustomColor(value);
              onChange(value);
            }}
          />
        </div>
      </div>
      <div
        role="progressbar"
        className={cn(
          "mt-3 h-0.5 w-full overflow-hidden bg-muted",
          !saved.isPending && "invisible",
        )}
        aria-label="저장한 색 불러오는 중"
        aria-hidden={!saved.isPending}
      >
        <div className="h-full w-1/3 animate-progress-slide bg-foreground motion-reduce:animate-none" />
      </div>
      {saved.isError && (
        <ErrorState
          message="저장한 색을 불러오지 못했어요."
          onRetry={() => void saved.refetch()}
        />
      )}
    </>
  );
};

export default EventCategoryColorPicker;
