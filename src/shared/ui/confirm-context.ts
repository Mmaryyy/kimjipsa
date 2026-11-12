"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

export type ConfirmOptions = {
  disabled?: () => boolean;
  title: string;
  description: string;
  targetName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  secondaryAction?: { label: string; onClick: () => void | Promise<unknown> };
  onConfirm?: () => void | Promise<unknown>;
  children?: ReactNode;
  theme?: "light" | "dark";
};
export type Confirm = (options: ConfirmOptions) => Promise<boolean>;
export const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("ConfirmProvider가 필요해요.");
  return confirm;
}

export const ConfirmOpenContext = createContext<() => boolean>(() => false);

export function useConfirmDisabled(disabled: boolean) {
  const current = useRef(disabled);
  useEffect(() => {
    current.current = disabled;
  }, [disabled]);
  return useCallback(() => current.current, []);
}
