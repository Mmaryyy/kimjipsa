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

it.each([
  ["event_created", "‘장보기’ 일정이 등록되었어요."],
  ["event_updated", "‘장보기’ 일정이 변경되었어요."],
  ["event_deleted", "‘장보기’ 일정이 삭제되었어요."],
  ["event_participants_changed", "‘장보기’ 일정의 참가 인원이 변경되었어요."],
] as const)(
  "CAL-09 SCN-CAL-6 %s 알림은 제목과 변경 종류를 구분해요",
  (kind, expected) => {
    const notification: Notification = {
      id: "test",
      user_id: "recipient",
      family_id: "family",
      kind,
      read_at: null,
      created_at: "2026-10-22T04:30:00Z",
      payload: { eventTitle: "장보기" },
    };
    expect(notificationMessage(notification)).toBe(expected);
    expect(notificationMessage({ ...notification, payload: {} })).toBe(
      expected.replace("‘장보기’ ", ""),
    );
  },
);
