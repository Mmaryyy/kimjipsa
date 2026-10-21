"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, subDays } from "date-fns";
import { tz } from "@date-fns/tz";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationsRead,
  notificationMessage,
  type Notification,
} from "@/entities/notification";
import { eventRoutes } from "@/shared/config";
import {
  Sheet,
  GroupLabel,
  List,
  ListRow,
  Text,
  TextButton,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonSection,
} from "@/shared/ui";
const dateOptions = { in: tz("Asia/Seoul") };
function dateGroup(instant: string, now: Date) {
  const date = format(new Date(instant), "yyyy-MM-dd", dateOptions);
  if (date === format(now, "yyyy-MM-dd", dateOptions)) return "오늘";
  if (date === format(subDays(now, 1, dateOptions), "yyyy-MM-dd", dateOptions))
    return "어제";
  return format(new Date(instant), "M월 d일", dateOptions);
}
function NotificationsSkeleton() {
  return (
    <SkeletonSection label="알림을 불러오고 있어요">
      <GroupLabel>
        <Skeleton className="h-3 w-10" />
      </GroupLabel>
      <List>
        {Array.from({ length: 3 }, (_, index) => (
          <ListRow
            key={index}
            leading={<Skeleton className="size-1.5 rounded-full" />}
            trailing={<Skeleton className="h-3 w-9" />}
          >
            <Skeleton className="my-1 h-4 w-full" />
            <Skeleton className="my-1 h-4 w-1/2" />
          </ListRow>
        ))}
      </List>
    </SkeletonSection>
  );
}
function NotificationRow({
  notification,
  disabled,
  onRead,
}: {
  notification: Notification;
  disabled: boolean;
  onRead: (notification: Notification) => void;
}) {
  const unread = notification.read_at === null;
  return (
    <ListRow data-od-id="notification-row">
      <TextButton
        className="w-full justify-start gap-3 whitespace-normal text-left font-normal text-foreground"
        disabled={disabled}
        onClick={() => onRead(notification)}
      >
        <span
          aria-hidden
          className={
            unread
              ? "size-1.5 flex-none rounded-full bg-primary"
              : "size-1.5 flex-none"
          }
        />
        <span className="min-w-0 flex-1">
          {unread && <span className="sr-only">안 읽음: </span>}
          {notificationMessage(notification)}
        </span>
        <time
          dateTime={notification.created_at}
          className="flex-none text-caption text-muted-foreground"
        >
          {format(new Date(notification.created_at), "HH:mm", dateOptions)}
        </time>
      </TextButton>
    </ListRow>
  );
}
function NotificationsList({
  onNavigate,
}: {
  onNavigate: (path?: string) => void;
}) {
  const notifications = useNotifications();
  const mark = useMarkNotificationsRead();
  const unreadCount = useUnreadNotificationCount();
  const [failure, setFailure] = useState("");
  const onRead = async (notification?: Notification) => {
    setFailure("");
    try {
      await mark.mutateAsync(notification ? { id: notification.id } : {});
      if (
        notification &&
        notification.kind !== "event_deleted" &&
        !notification.payload.eventDeleted
      )
        onNavigate(
          `${eventRoutes.calendar}?event=${encodeURIComponent(notification.payload.eventId)}`,
        );
      else if (notification) onNavigate();
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "읽음 처리하지 못했어요.",
      );
    }
  };
  const unread = (unreadCount.data ?? 0) > 0;
  const groups = new Map<string, Notification[]>();
  const now = new Date();
  for (const entry of notifications.data ?? []) {
    const label = dateGroup(entry.created_at, now);
    const group = groups.get(label) ?? [];
    group.push(entry);
    groups.set(label, group);
  }
  let content;
  if (notifications.isPending) content = <NotificationsSkeleton />;
  else if (notifications.isError)
    content = (
      <ErrorState
        message={notifications.error.message}
        onRetry={() => {
          void notifications.refetch();
        }}
      />
    );
  else if (!notifications.data.length)
    content = <EmptyState message="아직 알림이 없어요" />;
  else
    content = Array.from(groups, ([label, entries]) => (
      <section key={label} data-od-id="notifications-group" aria-label={label}>
        <GroupLabel>{label}</GroupLabel>
        <List>
          {entries.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              disabled={mark.isPending}
              onRead={(entry) => {
                void onRead(entry);
              }}
            />
          ))}
        </List>
      </section>
    ));
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onNavigate();
      }}
      title="알림"
      description="최근 알림 30개를 확인할 수 있어요."
      odId="notifications-main"
      closeOdId="notifications-close"
      closePosition="end"
      closeIcon
      className="h-[var(--sheet-mobile-max-height)] md:h-[var(--sheet-desktop-max-height)]"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        document
          .querySelector<HTMLElement>('[data-od-id="home-notifications"]')
          ?.focus();
      }}
      action={
        <TextButton
          data-od-id="notifications-read-all"
          disabled={!unread || mark.isPending}
          onClick={() => {
            void onRead();
          }}
        >
          모두 읽음
        </TextButton>
      }
    >
      {failure && (
        <Text as="p" role="alert" className="text-error-text">
          {failure}
        </Text>
      )}
      {content}
    </Sheet>
  );
}

export function NotificationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const open = searchParams?.get("notifications") === "open";
  if (!open) return null;
  const onNavigate = (path?: string) => {
    if (path) {
      router.replace(path);
    } else if (window.history.state?.notificationsOpened) {
      router.back();
    } else {
      const params = new URLSearchParams(searchParams?.toString());
      params.delete("notifications");
      router.replace(params.size ? `/?${params}` : "/", { scroll: false });
    }
  };
  return <NotificationsList onNavigate={onNavigate} />;
}
