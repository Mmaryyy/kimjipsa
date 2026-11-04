"use client";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
export const Loader = ({ className, ...props }: ComponentProps<"svg">) => (
  <LoaderCircle
    aria-hidden="true"
    className={cn("size-4 motion-safe:animate-spin", className)}
    {...props}
  />
);
