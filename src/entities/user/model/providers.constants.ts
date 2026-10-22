export const providerOptions = [
  { value: "kakao", label: "카카오 계정" },
  { value: "google", label: "Google 계정" },
] as const;

export type LoginProvider = (typeof providerOptions)[number]["value"];
export const providers = providerOptions.map((option) => option.value);
