export const periodOptions = [
  { value: "am", label: "오전" },
  { value: "pm", label: "오후" },
];
export const hourOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));
export const minuteOptions = Array.from({ length: 60 }, (_, index) => {
  const value = String(index).padStart(2, "0");
  return { value, label: value };
});
