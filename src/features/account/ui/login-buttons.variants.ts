import { cva } from "class-variance-authority";

export const loginButtonStyles = cva("h-[46px] w-full min-w-0 rounded-[12px]", {
  variants: {
    provider: {
      kakao: "overflow-hidden bg-[var(--oauth-kakao-bg)] p-0 text-inherit",
      google: [
        "bg-[var(--oauth-google-bg)] py-0 font-app text-[14px] leading-[20px]",
        "font-medium tracking-normal text-[color:var(--oauth-google-fg)]",
        "shadow-[inset_0_0_0_1px_var(--oauth-google-border)]",
      ],
    },
  },
});
