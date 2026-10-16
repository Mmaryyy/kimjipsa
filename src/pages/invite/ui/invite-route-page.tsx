import { InvitePage } from "./invite-page";
export async function InviteRoutePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitePage token={token} />;
}
