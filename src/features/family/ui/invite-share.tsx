"use client";
import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/shared/lib";
import { invitePath } from "@/shared/config";
import { Button, EmptyState, ListSkeleton, Text } from "@/shared/ui";
import { useInviteShare } from "../model/use-family";
const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";
export function InviteShare() {
  const { invitation, onCreate, onShare, pending, error, shareMessage } =
    useInviteShare();
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  return (
    <section className="grid gap-3" aria-labelledby="invite-share-title">
      <Text as="h2" variant="title-sm" id="invite-share-title">
        함께 쓸 사람을 초대해요
      </Text>
      <Text as="p" variant="caption" className="text-muted-foreground">
        링크는 한 번만 쓸 수 있고, 만든 뒤 3일 동안 유효해요. 한 명마다 새
        링크를 만들어 주세요.
      </Text>
      {!invitation && !pending && !error && (
        <EmptyState message="아직 만든 초대 링크가 없어요." />
      )}
      <Button onClick={onCreate} disabled={pending}>
        {pending ? "초대 링크를 만들고 있어요" : "새 초대 링크 만들기"}
      </Button>
      {pending && <ListSkeleton rows={1} label="초대 링크를 만들고 있어요" />}
      {error && (
        <Text as="p" role="alert" className="text-error-text">
          {error.message} 새 초대 링크 만들기로 다시 시도해 주세요.
        </Text>
      )}
      {invitation && (
        <div className="grid gap-3">
          <label htmlFor="inviteLink" className="text-caption">
            초대 링크
          </label>
          <input
            id="inviteLink"
            className="kj-input"
            readOnly
            value={`${origin}${invitePath(invitation.token)}`}
          />
          <Text as="p" variant="caption">
            만료 시각: {formatDateTime(invitation.expiresAt)}
          </Text>
          <Button variant="gray" onClick={onShare}>
            링크 공유·복사하기
          </Button>
        </div>
      )}
      {shareMessage && (
        <Text as="p" role="status">
          {shareMessage}
        </Text>
      )}
    </section>
  );
}
