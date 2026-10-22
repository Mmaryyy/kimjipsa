import type { Dialog } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
// shadcn/ui의 Portal·Overlay·Content 구성으로 포커스 가두기와 복귀를 유지해요.
export type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger?: ReactNode;
  theme?: "light" | "dark";
};

export type SheetProps = OverlayProps & {
  children: ReactNode;
  action?: ReactNode;
  leadingAction?: (onOpenChange: OverlayProps["onOpenChange"]) => ReactNode;
  showCloseButton?: boolean;
  odId?: string;
  className?: string;
  hideHeader?: boolean;
  overlayClassName?: string;
  onOpenAutoFocus?: ComponentProps<typeof Dialog.Content>["onOpenAutoFocus"];
  onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"];
};
