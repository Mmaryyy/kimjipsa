"use client";
import { Button } from "@/shared/ui";
import { Bell } from "lucide-react";
import { useNotifications } from "../../model/use-notifications";
const NotificationBell = () => {
  const notifications = useNotifications();
  const count =
    notifications.data?.filter((entry) => entry.read_at === null).length ?? 0;
  return (
    <Button
      variant="glass"
      size="icon"
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
      className="relative"
    >
      <Bell aria-hidden className="size-5 text-muted-foreground" />
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
    </Button>
  );
};
export default NotificationBell;
