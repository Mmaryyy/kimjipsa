import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const fontSizeNames = [
  "display",
  "title-lg",
  "title",
  "title-sm",
  "headline",
  "body-lg",
  "body",
  "body-sm",
  "label",
  "caption",
  "caption-sm",
  "caption-xs",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: fontSizeNames }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
