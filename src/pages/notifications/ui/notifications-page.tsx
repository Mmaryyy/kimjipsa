"use client";
import { LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, subDays } from "date-fns";
import { tz } from "@date-fns/tz";
import {
  useNotifications,
  useMarkNotificationsRead,
  notificationMessage,
  notificationEventId,
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
import { cn } from "@/shared/lib";
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
      <Skeleton className="h-56" />
    </SkeletonSection>
  );
}
function NotificationRow({
  notification,
  disabled,
  pending,
  onRead,
}: {
  notification: Notification;
  disabled: boolean;
  pending: boolean;
  onRead: (notification: Notification) => void;
}) {
  const unread = notification.read_at === null;
  return (
    <ListRow data-od-id="notification-row">
      <TextButton
        className="w-full justify-start gap-3 whitespace-normal text-left font-normal text-foreground"
        disabled={disabled}
        aria-busy={pending}
        onClick={() => onRead(notification)}
      >
        <div className="flex flex-row w-full gap-1 items-center">
          {pending ? (
            <LoaderCircle
              aria-label="읽음 처리 중"
              className="mt-0.5 size-4 shrink-0 self-start animate-spin motion-reduce:animate-none"
            />
          ) : (
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-2 shrink-0 self-start rounded-full mx-1",
                unread ? "bg-primary" : "bg-[var(--sys-gray4)]",
              )}
            />
          )}
          <div className="flex min-w-0 flex-row flex-1 items-start justify-between">
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {unread && <span className="sr-only">안 읽음: </span>}
              {notificationMessage(notification)}
            </span>
            <time
              dateTime={notification.created_at}
              className="flex-none text-caption text-muted-foreground"
            >
              {format(new Date(notification.created_at), "HH:mm", dateOptions)}
            </time>
          </div>
        </div>
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
  const busy = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const onRead = async (notification?: Notification) => {
    if (busy.current) return;
    busy.current = true;
    setPendingId(notification?.id ?? "all");
    setFailure("");
    try {
      await mark.mutateAsync(notification ? { id: notification.id } : {});
      if (notification && notification.kind === "morning_summary")
        onNavigate(
          `${eventRoutes.calendar}?date=${notification.payload.date}&view=day`,
        );
      else if (
        notification &&
        notification.payload.eventId &&
        notification.kind !== "event_deleted" &&
        !notification.payload.eventDeleted
      )
        onNavigate(
          `${eventRoutes.calendar}?event=${encodeURIComponent(notificationEventId(notification.payload)!)}`,
        );
      else if (notification) onNavigate();
    } catch (error) {
      busy.current = false;
      setPendingId(null);
      setFailure(
        error instanceof Error ? error.message : "읽음 처리하지 못했어요.",
      );
    } finally {
      if (!notification) {
        busy.current = false;
        setPendingId(null);
      }
    }
  };
  const unread =
    notifications.data?.some((entry) => entry.read_at === null) ?? false;
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
              disabled={pendingId !== null}
              pending={pendingId === notification.id}
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
      showCloseButton
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
          disabled={!unread || pendingId !== null}
          aria-busy={pendingId === "all"}
          onClick={() => {
            void onRead();
          }}
        >
          {pendingId === "all" && (
            <LoaderCircle
              aria-hidden
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          )}
          {pendingId === "all" ? "읽음 처리 중" : "모두 읽음"}
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
