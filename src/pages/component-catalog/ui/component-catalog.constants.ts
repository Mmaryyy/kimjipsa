import {
  categoryColors,
  type TextVariant,
  type StatusVariant,
} from "@/shared/ui";

const textSamples = {
  display: null,
  "title-lg": null,
  title: null,
  "title-sm": null,
  headline: null,
  "body-lg": null,
  body: null,
  "body-sm": null,
  label: null,
  caption: null,
  "caption-sm": null,
  "caption-xs": null,
} satisfies Record<TextVariant, null>;

export const textVariants = Object.keys(textSamples) as TextVariant[];

export const categoryColorOptions = Object.keys(
  categoryColors,
) as (keyof typeof categoryColors)[];

export const viewOptions = [
  { value: "month", label: "월" },
  { value: "week", label: "주" },
  { value: "day", label: "일" },
] as const;
export const filterOptions = [
  { value: "all", label: "전체" },
  { value: "first", label: "첫 번째 목록" },
  { value: "second", label: "두 번째 목록" },
  { value: "long", label: "이름이 아주 긴 목록도 선택할 수 있어요" },
] as const;
const buttonLabels = {
  primary: "저장하기",
  gray: "닫기",
  danger: "삭제하기",
  success: "반영하기",
  info: "확인하기",
  warning: "확인하기",
  error: "삭제하기",
} as const;
type ButtonOption = {
  [Variant in keyof typeof buttonLabels]: [
    Variant,
    (typeof buttonLabels)[Variant],
  ];
}[keyof typeof buttonLabels];
export const buttonOptions = Object.entries(buttonLabels) as ButtonOption[];
export const statusLabels = {
  success: "반영됐어요",
  info: "알려드려요",
  warning: "확인해 주세요",
  error: "처리하지 못했어요",
} as const satisfies Record<StatusVariant, string>;

export const statusVariants = Object.keys(statusLabels) as StatusVariant[];
