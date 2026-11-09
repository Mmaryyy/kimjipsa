// @vitest-environment node
/* eslint-disable tokens/no-color-literals -- 저장 색 응답을 검증해요. */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SharedServer from "@/shared/server";
import { ApiError } from "@/shared/api";
import { authenticatedClient } from "@/entities/user/index.server";
import { saveEventCategory } from "@/entities/event/index.server";
import {
  categoriesGET,
  savedCategoryColorsGET as savedColorsGET,
} from "./event-routes";

const state = vi.hoisted(() => ({
  enabled: true,
  perspective: 0,
  stage: "ready",
  values: new Map<string, unknown>(),
  fixtures: {} as Record<string, unknown>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/entities/user/index.server", () => ({
  authenticatedClient: vi.fn(),
}));
vi.mock("@/shared/server", async (original) => ({
  ...(await original<typeof SharedServer>()),
  isServerMockDataEnabled: async () => state.enabled,
  mockContext: async () => (state.enabled ? state : null),
  mockJson: async (name: string) => state.fixtures[name],
}));
const request = () =>
  new Request("http://localhost/api/event-categories/saved-colors");
beforeEach(() => {
  vi.clearAllMocks();
  state.enabled = true;
  state.stage = "ready";
  state.values.clear();
  for (const name of ["family", "event-categories"])
    state.fixtures[name] = JSON.parse(
      readFileSync(`mocks/${name}.json`, "utf8"),
    );
});
describe("CAL-08 저장 색 전용 API", () => {
  it("카테고리 목록은 쿼리와 관계없이 카테고리만 반환해요", async () => {
    const response = await categoriesGET(
      new Request("http://localhost/api/event-categories?savedColors=1"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).toHaveProperty("name");
    expect(body.data[0]).toHaveProperty("color");
  });
  it("목업에서 저장한 직접 색을 최신 순으로 중복 없이 반환해요", async () => {
    for (const [index, color] of ["#ab1234", "#cd5678", "#ab1234"].entries())
      await saveEventCategory({ name: `색 ${index}`, color, sortOrder: 0 });
    const response = await savedColorsGET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: ["#ab1234", "#cd5678"],
    });
    expect(authenticatedClient).not.toHaveBeenCalled();
  });
  it("로그인하지 않은 요청은 저장 색을 받지 못해요", async () => {
    state.enabled = false;
    vi.mocked(authenticatedClient).mockRejectedValue(
      new ApiError("unauthorized", "로그인이 필요해요.", 401),
    );
    const response = await savedColorsGET(request());
    expect(response.status).toBe(401);
  });
  it("실제 조회는 요청자의 가정으로 거르고 최신 순으로 반환해요", async () => {
    state.enabled = false;
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { family_id: "family" }, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: [{ color: "#ab1234" }], error: null }).then(
          resolve,
        ),
    };
    const from = vi.fn().mockReturnValue(query);
    vi.mocked(authenticatedClient).mockResolvedValue({
      client: { from },
      user: { id: "requester" },
    } as unknown as Awaited<ReturnType<typeof authenticatedClient>>);
    const response = await savedColorsGET(request());
    expect(await response.json()).toEqual({ ok: true, data: ["#ab1234"] });
    expect(from).toHaveBeenCalledWith("event_category_saved_colors");
    expect(query.eq).toHaveBeenCalledWith("family_id", "family");
    expect(query.order).toHaveBeenCalledWith("saved_at", { ascending: false });
    expect(query.order).toHaveBeenCalledWith("color");
  });
});
