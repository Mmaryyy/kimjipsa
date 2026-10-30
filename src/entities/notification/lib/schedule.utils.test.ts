import { describe, expect, it } from "vitest";
import { scheduledNotifications } from "./schedule.utils";
const user = { id: "owner", familyId: "family", morningTime: "10:00:00" };
const event = {
  title: "병원 예약",
  kind: "event" as const,
  id: "event",
  familyId: "family",
  ownerId: "owner",
  visibility: "shared" as const,
  startDate: "2026-10-22",
  endDate: "2026-10-22",
  startTime: "14:00:00",
  isAllDay: false,
  remindBefore: 30,
};
describe("CAL-10/11 예약 대상 · SCN-CAL-5~6", () => {
  it("CAL-14 같은 시각으로 옮긴 두 회차도 각각 알림을 예약한다", () => {
    const result = scheduledNotifications({
      now: "2026-10-22T04:30:00Z",
      users: [user],
      events: ["2026-10-15", "2026-10-22"].map((originalDate) => ({
        ...event,
        originalDate,
        recurrence: "weekly" as const,
      })),
    });
    expect(result).toHaveLength(2);
    expect(new Set(result.map((entry) => entry.key)).size).toBe(2);
  });
  it("14시 일정은 KST 13시 30분부터 5분 미만까지 같은 키로 보충한다", () => {
    const snapshot = {
      now: "2026-10-22T04:30:00Z",
      users: [user],
      events: [event],
    };
    const notifications = scheduledNotifications(snapshot);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.kind).toBe("event_reminder");
    expect(
      scheduledNotifications({ ...snapshot, now: "2026-10-22T04:35:00Z" }),
    ).toEqual([]);
    // Recovery ticks reuse the database unique key.
    expect(
      scheduledNotifications({ ...snapshot, now: "2026-10-22T04:34:59Z" })[0]
        ?.key,
    ).toBe(notifications[0]?.key);
  });
  it.each([true, false])(
    "종일·시간 미정은 전날 23시 30분에 알린다 (%s)",
    (isAllDay) => {
      const result = scheduledNotifications({
        now: "2026-10-21T14:30:00Z",
        users: [user],
        events: [{ ...event, startTime: null, isAllDay }],
      });
      expect(result.map((entry) => entry.kind)).toEqual(["event_reminder"]);
    },
  );
  it("개인 일정은 본인에게만 보내고 다른 가정은 제외한다", () => {
    const result = scheduledNotifications({
      now: "2026-10-22T04:30:00Z",
      users: [
        user,
        { ...user, id: "spouse" },
        { ...user, id: "other", familyId: "other" },
      ],
      events: [{ ...event, visibility: "private" }],
    });
    expect(result.map((entry) => entry.userId)).toEqual(["owner"]);
  });
  it("설정 시각에 오늘 일정을 시간순으로 한 건에 묶고 빈 요약은 보내지 않는다", () => {
    const result = scheduledNotifications({
      now: "2026-10-22T01:00:00Z",
      users: [user],
      events: [
        event,
        { ...event, id: "early", startTime: "09:00:00" },
        { ...event, id: "hidden", ownerId: "spouse", visibility: "private" },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.payload).toMatchObject({
      count: 2,
      times: ["09:00", "14:00"],
    });
    expect(JSON.stringify(result)).not.toContain("hidden");
    expect(
      scheduledNotifications({
        now: "2026-10-22T01:00:00Z",
        users: [user],
        events: [],
      }),
    ).toEqual([]);
  });
  it("ACC-11 · SCN-ACC-5 사용자 시각과 알림 없음 설정을 따른다", () => {
    const result = scheduledNotifications({
      now: "2026-10-21T23:00:00Z",
      users: [{ ...user, morningTime: "08:00:00" }],
      events: [{ ...event, remindBefore: null }],
    });
    expect(result.map((entry) => entry.kind)).toEqual(["morning_summary"]);
  });
});

describe("CAL-10/11 SCN-CAL-5~6 보충 경계", () => {
  it("아침 요약도 실패한 분을 보충하고 5분이 지나면 제외한다", () => {
    const snapshot = { users: [user], events: [event] };
    expect(
      scheduledNotifications({ ...snapshot, now: "2026-10-22T01:04:59Z" })[0]
        ?.key,
    ).toBe("morning:owner:2026-10-22");
    expect(
      scheduledNotifications({ ...snapshot, now: "2026-10-22T01:05:00Z" }),
    ).toEqual([]);
  });
  it("KST 자정을 넘어서 전날 아침 요약을 보충한다", () => {
    const result = scheduledNotifications({
      now: "2026-10-22T15:02:00Z",
      users: [{ ...user, morningTime: "23:59:00" }],
      events: [{ ...event, remindBefore: null }],
    });
    expect(result[0]?.payload.date).toBe("2026-10-22");
  });
  it("1440분 전 알림은 내일 일정의 시작 시각을 기준으로 한다", () => {
    const snapshot = {
      now: "2026-10-21T15:02:00Z",
      users: [user],
      events: [
        {
          ...event,
          startDate: "2026-10-23",
          endDate: "2026-10-23",
          startTime: null,
          remindBefore: 1440,
        },
      ],
    };
    expect(scheduledNotifications(snapshot)[0]?.payload).toMatchObject({
      date: "2026-10-23",
      eventTitle: "병원 예약",
      startTime: "시간 미정",
    });
  });
  it("시작 시각이 바뀌면 새 중복 방지 키를 만든다", () => {
    const base = scheduledNotifications({
      now: "2026-10-22T04:30:00Z",
      users: [user],
      events: [event],
    });
    const changed = scheduledNotifications({
      now: "2026-10-22T05:30:00Z",
      users: [user],
      events: [{ ...event, startTime: "15:00:00" }],
    });
    expect(base[0]?.key).not.toBe(changed[0]?.key);
  });
  it("여러 날 일정은 시작일 다음 날 요약에 종일로 표시한다", () => {
    const result = scheduledNotifications({
      now: "2026-10-22T01:00:00Z",
      users: [user],
      events: [{ ...event, startDate: "2026-10-21", endDate: "2026-10-23" }],
    });
    expect(result[0]?.payload.times).toEqual(["종일"]);
  });
});
