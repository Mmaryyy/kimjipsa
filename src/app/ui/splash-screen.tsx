import { cn } from "@/shared/lib";
import { BrandLogo } from "@/shared/ui";

export function SplashScreen({
  className,
  leaving = false,
}: {
  className?: string;
  leaving?: boolean;
}) {
  return (
    <div
      className={cn("kj-splash-screen", leaving && "leaving", className)}
      role="status"
      aria-label="김집사를 준비하고 있어요"
      data-od-id="splash-main"
    >
      <BrandLogo />
    </div>
  );
}
