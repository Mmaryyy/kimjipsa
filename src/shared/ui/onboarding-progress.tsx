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
        className="kj-onboarding-progress"
        aria-label="가입 진행"
        max={onboardingSteps}
        value={step}
      />
    </>
  );
}
