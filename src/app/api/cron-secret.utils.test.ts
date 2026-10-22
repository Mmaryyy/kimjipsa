// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { validCronSecret } from "./cron-secret.utils";
vi.mock("server-only", () => ({}));
const run = vi.hoisted(() => vi.fn());
vi.mock("@/entities/notification/index.server", () => ({
  runScheduledNotifications: run,
}));
import { cronNotificationsPOST } from "./cron-notifications-route";
describe("CAL-10/11 cron 시크릿 검사", () => {
  it("누락·빈 값·오류 시크릿을 거부한다", () => {
    expect(validCronSecret(null, "expected")).toBe(false);
    expect(validCronSecret("", "")).toBe(false);
    expect(validCronSecret("wrong", "expected")).toBe(false);
    expect(validCronSecret("expected", undefined)).toBe(false);
    expect(validCronSecret("expected", "expected")).toBe(true);
  });
  it("인증 없는 요청은 작업을 호출하지 않고 401을 돌려준다", async () => {
    run.mockClear();
    const response = await cronNotificationsPOST(
      new Request("http://localhost/api/cron/notifications", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
});
