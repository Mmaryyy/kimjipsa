"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConfirmHost } from "@/shared/ui/confirm-host";

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <ConfirmHost scope={pathname}>{children}</ConfirmHost>;
}
