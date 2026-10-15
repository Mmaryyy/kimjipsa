import type { ReactNode } from "react";
// shadcn/ui의 Portal·Overlay·Content 구성으로 포커스 가두기와 복귀를 유지해요.
export type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger?: ReactNode;
  theme?: "light" | "dark";
};
