// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { getAccount, saveBotType } from "./server";
import { botCharacters } from "../model/bot-character.constants";

const context = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  perspective: 0,
  stage: "ready",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", () => ({
  mockContext: async () => context,
  mockJson: async () => ({
    id: "family",
    members: [
      { user_id: "me", display_name: "나", role: "admin" },
      { user_id: "spouse", display_name: "배우자", role: "member" },
    ],
  }),
}));
beforeEach(() => {
  context.values.clear();
  context.perspective = 0;
  context.stage = "ready";
});
describe("BOT-18 사용자별 타입", () => {
  it("기본은 집사이고 저장 뒤 다시 조회해도 노비예요", async () => {
    expect((await getAccount()).botType).toBe("butler");
    await saveBotType({ botType: "nobi" });
    expect((await getAccount()).botType).toBe("nobi");
  });
  it("배우자의 선택은 내 타입에 영향이 없고 요청의 사용자 ID를 믿지 않아요", async () => {
    await saveBotType({ botType: "nobi", userId: "spouse" });
    context.perspective = 1;
    expect((await getAccount()).botType).toBe("butler");
    await saveBotType({ botType: "butler" });
    context.perspective = 0;
    expect((await getAccount()).botType).toBe("nobi");
  });
  it("알 수 없는 타입과 로그아웃 요청을 거절해요", async () => {
    await expect(saveBotType({ botType: "other" })).rejects.toThrow();
    context.stage = "login";
    await expect(saveBotType({ botType: "nobi" })).rejects.toMatchObject({
      status: 401,
    });
  });
  it("두 타입 모두 썸네일과 전신 에셋을 제공해요", () => {
    expect(botCharacters.butler.avatar).toBe("/images/kimjipsa-avatar.png");
    expect(botCharacters.nobi.full).toBe("/images/nobi/nobi-full.png");
    for (const character of Object.values(botCharacters)) {
      expect(existsSync(`public${character.avatar}`)).toBe(true);
      expect(existsSync(`public${character.full}`)).toBe(true);
    }
  });
});
