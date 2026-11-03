import { cva } from "class-variance-authority";

export const pageLayoutStyles = cva("w-full min-w-0", {
  variants: {
    width: {
      wide: "lg:max-w-280",
      narrow: "mx-auto lg:max-w-130",
    },
  },
});
