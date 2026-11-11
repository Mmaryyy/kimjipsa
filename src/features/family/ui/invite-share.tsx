"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { invitePath } from "@/shared/config";
import {
  Button,
  Skeleton,
  SkeletonSection,
  Text,
  TextButton,
} from "@/shared/ui";
import { useInviteShare } from "../model/use-family";
const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
const getShareSupported = () => typeof navigator.share === "function";
const getServerShareSupported = () => false;
export function InviteShare({
  onboarding = false,
  onLater,
}: {
  onboarding?: boolean;
  onLater?: () => void;
}) {
  const started = useRef(false);
  const { invitation, onCreate, onShare, pending, error, shareMessage } =
    useInviteShare();
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const shareSupported = useSyncExternalStore(
    subscribe,
    getShareSupported,
    getServerShareSupported,
  );
  useEffect(() => {
    if (onboarding && !invitation && !started.current) {
      started.current = true;
      onCreate();
    }
  }, [onboarding, invitation, onCreate]);
  return (
    <section
      className={onboarding ? "flex flex-1 flex-col gap-3" : "grid gap-3"}
      aria-label="초대 링크"
    >
      {(!onboarding || !invitation) && (
        <TextButton
          className="justify-start justify-self-start"
          data-od-id="set-invite"
          onClick={onCreate}
          disabled={pending}
        >
          {pending ? "초대 링크를 만들고 있어요" : "새 초대 링크 만들기"}
        </TextButton>
      )}
      {pending && (
        <SkeletonSection label="초대 링크를 만들고 있어요">
          <Skeleton />
        </SkeletonSection>
      )}
      {error && (
        <Text as="p" role="alert" className="text-error-text">
          {error.message} 새 초대 링크 만들기로 다시 시도해 주세요.
        </Text>
      )}
      {invitation && (
        <div>
          <div
            role="group"
            aria-label="초대 링크 값"
            data-od-id="ob-invite-link"
            className="flex items-center gap-3 bg-[var(--fill-quaternary)] p-3.5"
          >
            <code
              tabIndex={0}
              className="min-w-0 flex-1 font-mono text-body-sm break-all select-text"
            >
              {`${origin}${invitePath(invitation.token)}`}
            </code>
            <TextButton
              size="sm"
              className="shrink-0"
              data-od-id="ob-copy"
              onClick={() => void onShare(true)}
            >
              복사
            </TextButton>
          </div>
          <ul className="mt-4 text-body-sm text-muted-foreground [&>li]:py-1">
            <li>한 번 사용하면 링크가 닫혀요</li>
            <li>
              {format(new Date(invitation.expiresAt), "M월 d일 HH:mm", {
                in: tz("Asia/Seoul"),
              })}
              에 만료돼요 (3일)
            </li>
            <li>다른 가정에 속한 사람은 합류할 수 없어요</li>
          </ul>
        </div>
      )}
      {shareMessage && (
        <Text as="p" role="status">
          {shareMessage}
        </Text>
      )}
      <div className={onboarding ? "mt-auto grid gap-2 pt-5" : "grid gap-2"}>
        {invitation && shareSupported && (
          <Button
            size={onboarding ? "block" : "md"}
            data-od-id="ob-share"
            onClick={() => void onShare()}
          >
            카카오톡으로 보내기
          </Button>
        )}
        {onboarding && onLater && (
          <Button
            size="block"
            variant="gray"
            data-od-id="ob-later"
            onClick={onLater}
          >
            나중에 할게요
          </Button>
        )}
      </div>
    </section>
  );
}
