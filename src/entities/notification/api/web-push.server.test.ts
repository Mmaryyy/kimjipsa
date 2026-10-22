// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const send = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ default: { sendNotification: send } }));
import { sendWebPush } from "./web-push.server";
describe("CAL-09 웹 푸시 실패 처리", () => {
  it.each([404, 410, 503, undefined])(
    "만료와 재시도를 구분하고 로그에서 주소와 키를 숨긴다 (%s)",
    async (statusCode) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      send.mockRejectedValueOnce({
        statusCode,
        endpoint: "sensitive-endpoint",
        authorization: "sensitive-key",
      });
      expect(
        await sendWebPush(
          {
            endpoint: "sensitive-endpoint",
            keys: { auth: "sensitive-key", p256dh: "sensitive-key" },
          },
          { id: "id", body: "알림", url: "/" },
        ),
      ).toBe(statusCode === 404 || statusCode === 410 ? "expired" : "retry");
      expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive");
      log.mockRestore();
    },
  );
});
it("CAL-09 성공한 발송은 재시도 대상으로 반환하지 않는다", async () => {
  send.mockResolvedValueOnce({});
  await expect(
    sendWebPush(
      { endpoint: "test", keys: { auth: "test", p256dh: "test" } },
      { id: "id", body: "알림", url: "/" },
    ),
  ).resolves.toBe("sent");
});
