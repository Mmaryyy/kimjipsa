import { z } from "zod";
import { categoryColors } from "./category-color.constants";

export const categoryColorSchema = z.union(
  [
    z.enum(
      Object.keys(categoryColors) as [
        keyof typeof categoryColors,
        ...(keyof typeof categoryColors)[],
      ],
    ),
    z
      .templateLiteral(["#", z.string()])
      .refine((color) => /^#[0-9a-f]{6}$/.test(color)),
  ],
  { error: "카테고리 색을 선택해 주세요." },
);
