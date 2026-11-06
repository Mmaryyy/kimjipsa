// @vitest-environment node
import type * as ChatServer from "@/entities/chat-message/index.server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/entities/chat-message/index.server", async (original) => ({
  ...(await original<typeof ChatServer>()),
  agentRequest: vi.fn(),
}));
import { agentRequest } from "@/entities/chat-message/index.server";
import { agentCompletePOST } from "./agent-routes";
const jobId = "10000000-0000-4000-8000-000000000001";
const leaseToken = "10000000-0000-4000-8000-000000000002";
const item = {
  selected: true,
  name: "우유",
  quantity: 1,
  unit_id: null,
  inventory_item_id: null,
  category_id: null,
  location_id: null,
  expires_on: null,
};
const actions = [
  {
    domain: "cart",
    label: "우유 삭제",
    payload: { action: "delete", id: jobId },
  },
];
const request = (kind: string) =>
  new Request("http://localhost/api/agent/complete", {
    method: "POST",
    headers: { origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      leaseToken,
      kind,
      text: "확인해 주세요",
      requestQuote: "우유 삭제",
      actions,
      items: [item],
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(agentRequest).mockResolvedValue(null);
});
describe("BOT-07/08 SCN-BOT-5 대화 완료 경계", () => {
  it.each(["actions", "add", "proposal"])(
    "%s로 확인 절차를 우회할 수 없어요",
    async (kind) => {
      const response = await agentCompletePOST(request(kind));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        ok: false,
        error: { code: "confirmation_required" },
      });
      expect(agentRequest).not.toHaveBeenCalled();
    },
  );
  it("확인 제안만 검증한 액션으로 RPC에 넘겨요", async () => {
    const response = await agentCompletePOST(request("action_proposal"));
    expect(response.status).toBe(200);
    expect(agentRequest).toHaveBeenCalledWith(
      expect.any(Request),
      "complete",
      expect.objectContaining({
        kind: "action_proposal",
        actions: [
          expect.objectContaining({ payload: { action: "delete", id: jobId } }),
        ],
      }),
    );
  });
});
