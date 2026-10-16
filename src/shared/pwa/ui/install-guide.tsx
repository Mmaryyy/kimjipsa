"use client";
import { Button, Text } from "@/shared/ui";
import { useInstallGuide } from "../model/use-install-guide";
export function InstallGuide() {
  const { platform, canPrompt, onInstall, pending, error } = useInstallGuide();
  if (!platform || platform === "installed") return null;
  const instructions =
    platform === "ios"
      ? "Safari의 공유 버튼에서 ‘홈 화면에 추가’를 선택해 주세요. iOS 알림은 홈 화면에 설치한 뒤 사용할 수 있어요."
      : "브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.";
  return (
    <aside className="my-6 grid gap-3" aria-labelledby="install-guide-title">
      <Text as="h2" variant="title-sm" id="install-guide-title">
        홈 화면에서 바로 만나요
      </Text>
      <Text as="p" variant="caption" className="text-muted-foreground">
        {instructions}
      </Text>
      {canPrompt && (
        <Button variant="gray" onClick={onInstall} disabled={pending}>
          {pending ? "설치 화면을 열고 있어요" : "홈 화면에 설치하기"}
        </Button>
      )}
      {error && (
        <Text as="p" role="alert">
          {error}
        </Text>
      )}
    </aside>
  );
}
