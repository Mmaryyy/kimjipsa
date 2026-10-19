import { LoginFlow } from "./login-flow";

export async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; error?: string; step?: string }>;
}) {
  const { invite, error, step } = await searchParams;
  return (
    <LoginFlow
      inviteToken={invite}
      error={error}
      loginRequested={step === "login"}
    />
  );
}
