// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as SharedServer from "@/shared/server";
import { currentTermsVersion } from "@/shared/config";
import { authenticatedClient, saveProfile } from "./server";
const state = vi.hoisted(() => ({
  version: null as string | null,
  rpc: vi.fn(),
  profileRead: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", async (importOriginal) => ({
  ...(await importOriginal<typeof SharedServer>()),
  mockContext: async () => null,
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user", identities: [{ provider: "google" }] } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: state.profileRead }) }),
    }),
    rpc: state.rpc,
  }),
}));
beforeEach(() => {
  state.version = currentTermsVersion;
  state.profileRead.mockReset().mockImplementation(async () => ({
    data: { terms_version: state.version },
    error: null,
  }));
  state.rpc.mockReset().mockResolvedValue({ error: null });
});
describe("ACC-02 SCN-ACC-1 서버 재동의", () => {
  it.each([null, "draft-2026-10-16"])(
    "예전 동의 %s는 공용 인증에서 403으로 막아요",
    async (version) => {
      state.version = version;
      await expect(authenticatedClient()).rejects.toMatchObject({
        code: "consent_required",
        status: 403,
      });
      await expect(
        authenticatedClient({ allowUnconsented: true }),
      ).resolves.toHaveProperty("user.id", "user");
    },
  );
  it("현재 동의는 통과하고 이름 변경은 동의 플래그를 보내지 않아요", async () => {
    await expect(authenticatedClient()).resolves.toHaveProperty(
      "user.id",
      "user",
    );
    await saveProfile({ displayName: "새이름" });
    expect(state.rpc).toHaveBeenCalledWith("complete_profile", {
      display_name: "새이름",
      terms_accepted: false,
      privacy_accepted: false,
    });
  });
  it("이름 수정으로 재동의를 우회하지 못하고 명시적 동의만 저장해요", async () => {
    state.version = null;
    await expect(saveProfile({ displayName: "새이름" })).rejects.toMatchObject({
      code: "consent_required",
      status: 403,
    });
    expect(state.rpc).not.toHaveBeenCalled();
    await saveProfile({
      displayName: "새이름",
      termsAccepted: true,
      privacyAccepted: true,
    });
    expect(state.rpc).toHaveBeenCalledWith("complete_profile", {
      display_name: "새이름",
      terms_accepted: true,
      privacy_accepted: true,
    });
  });
  it("DB에 저장하는 약관 버전과 화면 버전이 같아요", () => {
    const sql = readdirSync("supabase/migrations")
      .sort()
      .map((filename) =>
        readFileSync(`supabase/migrations/${filename}`, "utf8"),
      )
      .filter((migration) =>
        migration.includes(
          "create or replace function public.complete_profile",
        ),
      )
      .at(-1)!;
    expect(sql.match(/now\(\), now\(\), '([^']+)'/)?.[1]).toBe(
      currentTermsVersion,
    );
    expect(sql).toContain("from public, anon");
    expect(sql).toContain("to authenticated");
  });
});
