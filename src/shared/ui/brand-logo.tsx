"use client";
import { useState } from "react";
import { cn } from "@/shared/lib";
import { wordmarkStyles } from "./onboarding.variants";
import Image from "next/image";

/** characterSrc 가 없으면 같은 자리를 비워 두고, 그림은 다 받은 뒤에 서서히 보여 준다. */
export function BrandLogo({
  characterSrc,
  typing = false,
}: {
  characterSrc?: string;
  /** 스플래시에서만 '김노비 → 김집사' 타이핑을 보여 준다. */
  typing?: boolean;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string>();
  return (
    <div className="text-center" data-od-id="splash-brand">
      {characterSrc ? (
        <Image
          className={cn(
            "mx-auto mb-6 size-45 object-contain opacity-0",
            "transition-opacity duration-[var(--dur)] ease-[var(--ease)] motion-reduce:transition-none",
            loadedSrc === characterSrc && "opacity-100",
          )}
          src={characterSrc}
          alt="김집사 캐릭터"
          width={180}
          height={180}
          priority
          onLoad={() => setLoadedSrc(characterSrc)}
          data-od-id="splash-character"
        />
      ) : (
        <div aria-hidden className="mx-auto mb-6 size-45" />
      )}
      <h1 className={wordmarkStyles()} data-od-id="splash-wordmark">
        {typing ? (
          <>
            <span className="sr-only">김집사</span>
            {/* 같은 칸에 보이지 않는 '김집사'(+커서 폭)를 겹쳐 폭을 고정해 '김'이 움직이지 않게 한다. */}
            <span
              aria-hidden
              className="inline-grid text-left motion-reduce:hidden [&>*]:[grid-area:1/1]"
            >
              <span className="invisible pr-[0.4ch]">김집사</span>
              <span>
                김
                {/* shortcut: 플러그인은 단어를 통째로 지우고 무한 반복한다. 첫 단어를 폭 없는 공백(U+200B)으로 두어
                    '김'만 먼저 보이게 하고, 반복 횟수를 덮어써 '김집사'에서 멈춘다. 한 바퀴 3.2초:
                    김 0~0.88초, 김노비 1.06초, 김 1.94초, 김집사 2.22초, 0.78회=2.5초에 멈춤.
                    글자 수·시간을 바꾸면 이 값과 AccountGate 최소 시간도 다시 계산한다. */}
                <span className="typed-[​,노비,집사] typed-caret before:[animation-iteration-count:0.78] before:[animation-fill-mode:forwards]" />
              </span>
            </span>
            <span aria-hidden className="hidden motion-reduce:inline">
              김집사
            </span>
          </>
        ) : (
          "김집사"
        )}
      </h1>
    </div>
  );
}
