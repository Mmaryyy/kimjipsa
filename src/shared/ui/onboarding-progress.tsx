import { cn } from "@/shared/lib";
import { Text } from "./text";
import { TextButton } from "./text-button";

const onboardingSteps = 4;

export function OnboardingProgress({
  step,
  onBack,
}: {
  step: number;
  onBack?: () => void;
}) {
  return (
    <>
      <div className="flex min-h-10 items-center justify-between">
        {onBack ? (
          <TextButton data-od-id="ob-back" onClick={onBack}>
            ‹ 이전
          </TextButton>
        ) : (
          <span aria-hidden="true" />
        )}
        <Text variant="caption" className="text-muted-foreground tabular-nums">
          {step} / {onboardingSteps}
        </Text>
      </div>
      <progress
        className={cn([
          "mt-1 h-0.5 w-full appearance-none border-0 bg-muted text-foreground",
          "[&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground",
          "[&::-moz-progress-bar]:bg-foreground",
        ])}
        aria-label="가입 진행"
        max={onboardingSteps}
        value={step}
      />
    </>
  );
}
