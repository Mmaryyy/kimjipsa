import { expect, it } from "vitest";
import { notificationMessage } from "./notification.utils";
import type { Notification } from "../model/notification.schema";
it("CAL-11 SCN-CAL-5 시작 전 알림은 제목과 시작 시각을 보여 준다", () => {
  const notification: Notification = {
    id: "test",
    user_id: "owner",
    family_id: "family",
    kind: "event_reminder",
    read_at: null,
    created_at: "2026-10-22T04:30:00Z",
    payload: { eventTitle: "병원 예약", startTime: "14:00" },
  };
  expect(notificationMessage(notification)).toBe(
    "‘병원 예약’ · 14:00 시작 전이에요.",
  );
});
