export const reminderOptions = [
  { value: null, label: "없음" },
  { value: 10, label: "10분 전" },
  { value: 30, label: "30분 전" },
  { value: 60, label: "1시간 전" },
  { value: 1440, label: "하루 전" },
] as const;
export function reminderLabel(value: number | null) {
  return (
    reminderOptions.find((option) => option.value === value)?.label ?? "없음"
  );
}
