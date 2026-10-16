import { OnboardingFlow } from "./onboarding-flow";
export async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return <OnboardingFlow inviteToken={invite} />;
}
