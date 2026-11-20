"use client";

import Image from "next/image";
import { Banner, Button, Text } from "@/shared/ui";
import { useKakaoBrowser, useSignIn } from "../model/use-account";
import { loginButtonStyles } from "./login-buttons.variants";

export function LoginButtons({ inviteToken }: { inviteToken?: string | null }) {
  const isKakaoBrowser = useKakaoBrowser();
  const { pending, error, onKakao, onGoogle } = useSignIn(inviteToken);
  return (
    <div className="flex flex-1 flex-col gap-3" aria-busy={pending}>
      {isKakaoBrowser && (
        <Banner variant="warning" title="외부 브라우저에서 열어 주세요">
          카카오톡 안에서는 Google 로그인이 제한될 수 있어요. 이 링크를 Safari나
          Chrome에서 열어 주세요.
        </Banner>
      )}
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
      <div className="mt-auto grid gap-2">
        <Button
          className={loginButtonStyles({ provider: "kakao" })}
          data-od-id="ob-login-kakao"
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
          className={loginButtonStyles({ provider: "google" })}
          data-od-id="ob-login-google"
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
    </div>
  );
}
