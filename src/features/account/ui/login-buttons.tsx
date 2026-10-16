"use client";

import Image from "next/image";
import { cn } from "@/shared/lib";
import { Banner, Button, Text } from "@/shared/ui";
import { useKakaoBrowser, useSignIn } from "../model/use-account";

export function LoginButtons({ inviteToken }: { inviteToken?: string | null }) {
  const isKakaoBrowser = useKakaoBrowser();
  const { pending, error, onKakao, onGoogle } = useSignIn(inviteToken);
  return (
    <div className="grid gap-3" aria-busy={pending}>
      {isKakaoBrowser && (
        <Banner variant="warning" title="외부 브라우저에서 열어 주세요">
          카카오톡 안에서는 Google 로그인이 제한될 수 있어요. 이 링크를 Safari나
          Chrome에서 열어 주세요.
        </Banner>
      )}
      <div className="grid gap-2">
        <Button
          className={cn(
            "h-[46px] w-full min-w-0 justify-center overflow-hidden rounded-[12px] p-0",
            "bg-[var(--oauth-kakao-bg)]",
          )}
          onClick={onKakao}
          disabled={pending}
          aria-label="카카오 로그인"
        >
          <Image
            src="/images/oauth/kakao-login-complete-ko.svg"
            alt=""
            width={224}
            height={46}
            className="h-[46px] w-[224px] max-w-none shrink-0"
            unoptimized
          />
        </Button>
        <Button
          className={cn(
            "h-[46px] w-full min-w-0 justify-center rounded-[12px] px-3 py-0",
            "font-app text-[14px] leading-[20px] font-medium tracking-normal whitespace-nowrap",
            "bg-[var(--oauth-google-bg)] text-[var(--oauth-google-fg)]",
            "shadow-[inset_0_0_0_1px_var(--oauth-google-border)]",
          )}
          onClick={onGoogle}
          disabled={pending}
        >
          <span className="inline-flex shrink-0 items-center gap-[10px]">
            <Image
              src="/images/oauth/google-g-logo.png"
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0"
              unoptimized
            />
            Google로 계속하기
          </span>
        </Button>
      </div>
      {pending && (
        <Text as="p" role="status">
          로그인 화면으로 이동해요.
        </Text>
      )}
      {error && (
        <Text as="p" role="alert" className="text-error-text">
          {error.message}
        </Text>
      )}
    </div>
  );
}
