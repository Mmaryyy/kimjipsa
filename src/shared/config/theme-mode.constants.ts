export const themeModes = [
  { value: "system", label: "자동" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
] as const;
export type ThemeMode = (typeof themeModes)[number]["value"];
export const themeModeStorageKey = "kj:theme";
