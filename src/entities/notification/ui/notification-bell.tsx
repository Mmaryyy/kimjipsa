"use client";
import { TextButton } from "@/shared/ui";
import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "../model/use-notifications";
export function NotificationBell() {
  const notifications = useUnreadNotificationCount();
  const count = notifications.data ?? 0;
  return (
    <TextButton
      onClick={() => {
        const params = new URLSearchParams(window.location.search);
        params.set("notifications", "open");
        window.history.pushState(
          { notificationsOpened: true },
          "",
          `${window.location.pathname}?${params}`,
        );
      }}
      aria-label="알림"
      aria-describedby={count > 0 ? "unread-notifications" : undefined}
      data-od-id="home-notifications"
      className="kj-hit relative inline-flex size-11 items-center justify-center"
    >
      <Bell aria-hidden className="size-5 text-foreground" />
      {count > 0 && (
        <>
          <span
            aria-hidden
            className="absolute right-2 top-2 size-1.5 rounded-full bg-primary"
          />
          <span id="unread-notifications" className="sr-only">
            안 읽은 알림 {count}개
          </span>
        </>
      )}
    </TextButton>
  );
}
