import { LoginFlow } from "./login-flow";
import { Banner, PageHeader, Text } from "@/shared/ui";
export async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; error?: string }>;
}) {
  const { invite, error } = await searchParams;
  return (
    <div className="mx-auto grid max-w-md gap-6 py-8">
      <PageHeader title="우리 집에 김집사" />
      <Text as="p" className="text-muted-foreground">
        함께 챙기는 하루, 함께 돌보는 살림.
      </Text>
      {error && (
        <Banner variant="error" title="로그인을 마치지 못했어요">
          {error === "identity"
            ? "다른 로그인 수단으로 시도하거나 서비스 운영자에게 문의해 주세요"
            : "다시 로그인해 주세요. 계속되면 연결 설정을 확인해 주세요."}
        </Banner>
      )}
      <LoginFlow inviteToken={invite} />
    </div>
  );
}
