"use client";
import { useBotCharacter } from "@/features/account";
import { cn } from "@/shared/lib";
import { BrandLogo } from "@/shared/ui";

export function SplashScreen({
  className,
  leaving = false,
}: {
  className?: string;
  leaving?: boolean;
}) {
  const character = useBotCharacter();
  return (
    <div
      className={cn(
        [
          "fixed inset-0 z-70 grid place-items-center bg-background text-center",
          "[&>div]:transition-opacity [&>div]:duration-200 [&>div]:ease-out",
          "motion-reduce:[&>div]:transition-none",
        ],
        leaving && "[&>div]:opacity-0 motion-reduce:[&>div]:opacity-100",
        className,
      )}
      role="status"
      aria-label="김집사를 준비하고 있어요"
      data-od-id="splash-main"
    >
      <BrandLogo
        typing
        characterSrc={character.ready ? character.full : undefined}
      />
    </div>
  );
}
