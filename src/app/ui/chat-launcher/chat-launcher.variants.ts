import { cva } from "class-variance-authority";

export const chatLauncherStyles = cva([
  "relative grid h-[82px] w-[88px] place-items-center overflow-visible",
  "rounded-none bg-transparent p-0 text-inherit shadow-none transition-transform",
  "duration-[var(--dur-fast)] ease-[var(--ease)] active:scale-[0.94] active:opacity-100",
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
  "motion-reduce:transition-none",
]);
