// @vitest-environment node
import type * as NotificationServer from "@/entities/notification/index.server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleSnapshot } from "@/entities/notification/index.server";
import { scheduledNotifications } from "@/entities/notification/index.server";
vi.mock("server-only", () => ({}));
const run = vi.hoisted(() => vi.fn());
vi.mock("@/entities/notification/index.server", async (original) => ({
  ...(await original<typeof NotificationServer>()),
  runScheduledNotifications: run,
}));
import { cronNotificationsPOST } from "./cron-notifications-route";
afterEach(() => vi.unstubAllEnvs());
describe("CAL-14 CAL-10 CAL-11 반복 회차 알림", () => {
  it("취소 회차를 빼고 바뀐 회차 제목·시각으로 알림을 만들어요", async () => {
    const id = "10000000-0000-4000-8000-000000000001";
    const snapshot: ScheduleSnapshot = {
      now: "2026-10-30T00:30:00.000Z",
      users: [{ id, familyId: id, morningTime: "09:30" }],
      events: [
        {
          id,
          familyId: id,
          ownerId: id,
          visibility: "private",
          kind: "event",
          title: "원래 제목",
          startDate: "2026-10-02",
          endDate: "2026-10-02",
          startTime: "10:00",
          isAllDay: false,
          remindBefore: 30,
          recurrence: "weekly",
          exceptions: [
            {
              originalDate: "2026-10-30",
              cancelled: false,
              title: "바뀐 제목",
              startDate: "2026-10-30",
              endDate: "2026-10-30",
              startTime: "10:00",
              isAllDay: false,
              remindBefore: 30,
            },
          ],
        },
      ],
    };
    let candidates: ReturnType<typeof scheduledNotifications> = [];
    run.mockImplementation(
      async (normalize: (input: ScheduleSnapshot) => ScheduleSnapshot) => {
        candidates = scheduledNotifications(normalize(snapshot));
        return { scheduled: candidates.length };
      },
    );
    vi.stubEnv("CRON_SECRET", "test-only");
    const request = () =>
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
        headers: { "x-cron-secret": "test-only" },
      });
    expect((await cronNotificationsPOST(request())).status).toBe(200);
    expect(
      candidates.find((entry) => entry.kind === "event_reminder")?.payload,
    ).toMatchObject({ eventTitle: "바뀐 제목", occurrenceDate: "2026-10-30" });
    expect(
      candidates.find((entry) => entry.kind === "morning_summary")?.payload
        .count,
    ).toBe(1);
    snapshot.events[0].exceptions![0].cancelled = true;
    await cronNotificationsPOST(request());
    expect(candidates).toEqual([]);
  });
});
