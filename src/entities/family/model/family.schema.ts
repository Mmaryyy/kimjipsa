import { z } from "zod";

export const familySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "가정 이름을 입력해 주세요.")
    .refine(
      (name) => Array.from(name).length <= 10,
      "가정 이름은 10자 이하로 입력해 주세요.",
    ),
});
