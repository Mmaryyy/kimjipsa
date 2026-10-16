import { z } from "zod";

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "표시 이름을 입력해 주세요.")
    .refine(
      (name) => Array.from(name).length <= 6,
      "표시 이름은 6자 이하로 입력해 주세요.",
    ),
  termsAccepted: z
    .boolean({ error: "이용약관에 동의해 주세요." })
    .refine((accepted) => accepted, "이용약관에 동의해 주세요."),
  privacyAccepted: z
    .boolean({ error: "개인정보 처리방침에 동의해 주세요." })
    .refine((accepted) => accepted, "개인정보 처리방침에 동의해 주세요."),
});
