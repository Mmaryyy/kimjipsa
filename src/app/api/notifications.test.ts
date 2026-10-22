// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockData } from "@/shared/server";
import {
  saveEvent,
  deleteEvent,
  listEvents,
} from "@/entities/event/index.server";
import {
  listNotifications,
  markNotificationsRead,
} from "@/entities/notification/index.server";
import {
  getNotificationSettings,
  saveNotificationSettings,
} from "@/entities/user/index.server";
const state = vi.hoisted(() => ({
  perspective: 0,
  stage: "ready",
  values: new Map<string, unknown>(),
  fixtures: {} as Record<string, unknown>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", () => ({
  mockContext: async () => state,
  mockJson: async (name: string) => state.fixtures[name],
  createServerSupabaseClient: vi.fn(() => {
    throw new Error("목업에서 DB에 접근했어요.");
  }),
  throwDatabaseError: vi.fn(),
}));
function fixture<Name extends keyof MockData>(name: Name): MockData[Name] {
  return state.fixtures[name] as MockData[Name];
}
function input(visibility: "shared" | "private" = "shared") {
  return {
    title: "치과 정기검진",
    place: "개인 장소",
    memo: "개인 메모",
    categoryId: fixture("event-categories")[0]!.id,
    visibility,
    startDate: "2026-10-21",
    endDate: "2026-10-21",
    startTime: null,
    endTime: null,
    isAllDay: true,
    remindBefore: 30,
  };
}
beforeEach(() => {
  state.perspective = 0;
  state.stage = "ready";
  state.values.clear();
  for (const name of [
    "family",
    "events",
    "event-categories",
    "notifications",
    "notification-settings",
    "home-settings",
  ] as const) {
    state.fixtures[name] = JSON.parse(
      readFileSync(`mocks/${name}.json`, "utf8"),
    );
  }
  state.fixtures.notifications = [];
});
describe("CAL-09 앱 내 변경 알림", () => {
  it("SCN-CAL-5 공유 일정 추가·변경·삭제를 변경자 외 모든 구성원에게 남겨요", async () => {
    const family = fixture("family");
    family.members.push({
      user_id: "90000000-0000-4000-8000-000000000001",
      display_name: "가족",
      role: "member",
    });
    const id = await saveEvent(input());
    await saveEvent({ ...input(), title: "정기검진" }, id);
    await deleteEvent(id);
    expect(await listNotifications()).toEqual([]);
    state.perspective = 1;
    const notifications = await listNotifications();
    expect(notifications.map((row) => row.kind).sort()).toEqual([
      "event_created",
      "event_deleted",
      "event_updated",
    ]);
    expect(
      notifications.every(
        (row) =>
          row.payload.eventId === id &&
          row.payload.actorName === "지수" &&
          row.payload.eventDeleted,
      ),
    ).toBe(true);
    expect(fixture("notifications")).toHaveLength(6);
    expect(JSON.stringify(notifications)).not.toContain("개인 메모");
    expect(JSON.stringify(notifications)).not.toContain("개인 장소");
  });
  it("SCN-CAL-5 개인 일정 추가·변경·삭제는 배우자에게 남기지 않아요", async () => {
    const id = await saveEvent(input("private"));
    await saveEvent({ ...input("private"), title: "비공개" }, id);
    await deleteEvent(id);
    state.perspective = 1;
    expect(await listNotifications()).toEqual([]);
  });
  it("SCN-CAL-5 공유 일정을 개인으로 바꾸면 이전 알림에서도 제목을 지워요", async () => {
    const id = await saveEvent(input());
    await saveEvent(input("private"), id);
    state.perspective = 1;
    expect((await listNotifications())[0]?.payload.eventTitle).toBeUndefined();
    expect(await listNotifications()).toHaveLength(1);
  });
  it("SCN-CAL-5 개인 전환 후 삭제해도 이전 알림에 삭제 표시를 남겨요", async () => {
    const id = await saveEvent(input());
    await saveEvent(input("private"), id);
    await deleteEvent(id);
    state.perspective = 1;
    expect((await listNotifications())[0]?.payload).toMatchObject({
      eventDeleted: true,
    });
    expect((await listNotifications())[0]?.payload).not.toHaveProperty(
      "eventTitle",
    );
  });
  it("SCN-CAL-5 최근 30개만 보여 주고 모두 읽음 처리해요", async () => {
    for (let index = 0; index < 35; index++) await saveEvent(input());
    state.perspective = 1;
    expect(await listNotifications()).toHaveLength(30);
    expect(
      (await listNotifications()).filter((entry) => !entry.read_at),
    ).toHaveLength(30);
    await markNotificationsRead({});
    expect(
      (await listNotifications()).every((entry) => entry.read_at !== null),
    ).toBe(true);
  });
  it("SCN-CAL-5 본인 알림만 하나씩 또는 모두 읽음 처리해요", async () => {
    await saveEvent(input());
    await saveEvent(input());
    state.perspective = 1;
    const [first, second] = await listNotifications();
    state.perspective = 0;
    await markNotificationsRead({ id: first!.id });
    expect(first!.read_at).toBeNull();
    state.perspective = 1;
    await markNotificationsRead({ id: first!.id });
    expect(first!.read_at).not.toBeNull();
    expect(second!.read_at).toBeNull();
    const readAt = first!.read_at;
    await markNotificationsRead({});
    expect(second!.read_at).not.toBeNull();
    expect(first!.read_at).toBe(readAt);
  });
  it("SCN-CAL-5 다른 가정의 알림을 읽거나 바꾸지 못해요", async () => {
    await saveEvent(input());
    fixture("notifications")[0]!.family_id =
      "90000000-0000-4000-8000-000000000099";
    state.perspective = 1;
    expect(await listNotifications()).toEqual([]);
    await markNotificationsRead({});
    expect(fixture("notifications")[0]!.read_at).toBeNull();
  });
});
describe("CAL-11 일정 알림 시점 입력", () => {
  it.each([null, 10, 30, 60, 1440])(
    "SCN-CAL-5 종일·시간 미정 일정에 %s분을 저장해요",
    async (remindBefore) => {
      const id = await saveEvent({ ...input(), remindBefore });
      expect(
        (await listEvents()).find((event) => event.id === id)?.remindBefore,
      ).toBe(remindBefore);
      await saveEvent({ ...input(), isAllDay: false, remindBefore }, id);
      expect(
        (await listEvents()).find((event) => event.id === id)?.remindBefore,
      ).toBe(remindBefore);
    },
  );
  it.each([-1, 0, 20, "30", 30.5])(
    "SCN-CAL-5 잘못된 알림 값 %s를 거절해요",
    async (remindBefore) => {
      await expect(saveEvent({ ...input(), remindBefore })).rejects.toThrow();
      expect(fixture("notifications")).toHaveLength(0);
    },
  );
  it("SCN-CAL-5 새 일정은 기본 30분 전이에요", async () => {
    const values = input();
    const withoutReminder: Partial<typeof values> = { ...values };
    delete withoutReminder.remindBefore;
    const id = await saveEvent(withoutReminder);
    expect(
      (await listEvents()).find((event) => event.id === id)?.remindBefore,
    ).toBe(30);
  });
});
describe("ACC-11 알림 설정", () => {
  it("SCN-ACC-5 기본값과 사용자별 저장을 유지해요", async () => {
    expect(await getNotificationSettings()).toEqual({
      pushEnabled: true,
      morningSummaryTime: "10:00",
    });
    await saveNotificationSettings({
      pushEnabled: false,
      morningSummaryTime: "08:30",
    });
    expect(await getNotificationSettings()).toEqual({
      pushEnabled: false,
      morningSummaryTime: "08:30",
    });
    state.perspective = 1;
    expect(await getNotificationSettings()).toEqual({
      pushEnabled: true,
      morningSummaryTime: "10:00",
    });
    state.perspective = 0;
    expect((await getNotificationSettings()).pushEnabled).toBe(false);
  });
  it.each(["24:00", "10:60", "9:00", "10:00:01", ""])(
    "SCN-ACC-5 잘못된 시각 %s를 거절해요",
    async (morningSummaryTime) => {
      await expect(
        saveNotificationSettings({ pushEnabled: true, morningSummaryTime }),
      ).rejects.toThrow();
    },
  );
});
