"use client";

import type { LucideIcon } from "lucide-react";
import { type ComponentProps, useId } from "react";

type AiGradientIconProps = Omit<
  ComponentProps<LucideIcon>,
  "stroke" | "fill" | "viewBox"
> & {
  icon: LucideIcon;
};

export const AiGradientIcon = ({
  icon: Icon,
  ...props
}: AiGradientIconProps) => {
  const gradientId = useId();

  return (
    <>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute"
        width="0"
        height="0"
        focusable="false"
      >
        <defs>
          {/* Use the 24-unit Lucide viewBox so straight paths also receive the gradient. */}
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="scale(24)"
          >
            <stop offset="0%" stopColor="var(--ai-gradient-from)" />
            <stop offset="100%" stopColor="var(--ai-gradient-to)" />
          </linearGradient>
        </defs>
      </svg>
      <Icon {...props} fill="none" stroke={`url(#${gradientId})`} />
    </>
  );
};
