// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { MockData } from "@/shared/server";
import type * as SharedServer from "@/shared/server";
import { withdrawAccount } from "@/entities/user/index.server";
import { changeMemberRole, getFamily } from "@/entities/family/index.server";

const state = vi.hoisted(() => ({
  context: {
    perspective: 0,
    stage: "ready",
    values: new Map<string, unknown>(),
  },
  rpc: vi.fn(),
  live: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/entities/user/api/server", () => ({
  authenticatedClient: async () => ({ client: { rpc: state.rpc } }),
}));
vi.mock("@/shared/server", async (original) => {
  const actual = await original<typeof SharedServer>();
  return {
    ...actual,
    createServerSupabaseClient: async () => ({ rpc: state.rpc }),
    mockContext: async () => (state.live ? null : state.context),
    mockJson: async (name: string) => state.context.values.get(name),
  };
});
function fixture<Name extends keyof MockData>(name: Name): MockData[Name] {
  return JSON.parse(
    readFileSync(`mocks/${name}.json`, "utf8"),
  ) as MockData[Name];
}
function family() {
  return state.context.values.get("family") as MockData["family"];
}

beforeEach(() => {
  state.live = false;
  state.context.perspective = 0;
  state.context.values.clear();
  for (const name of [
    "family",
    "events",
    "cart-items",
    "invites",
    "inventory-items",
  ] as const) {
    state.context.values.set(name, fixture(name));
  }
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ error: null });
});

describe("ACC-15 SCN-ACC-6 탈퇴와 관리자 권한", () => {
  it("개인 일정은 지우고 공유 일정과 장바구니는 작성자를 비워 남겨요", async () => {
    const actor = family().members[0]!.user_id;
    const events = fixture("events");
    const shared = {
      ...events[0]!,
      owner_id: actor,
      visibility: "shared" as const,
    };
    const privateEvent = {
      ...events[0]!,
      id: crypto.randomUUID(),
      owner_id: actor,
      visibility: "private" as const,
    };
    state.context.values.set("events", [shared, privateEvent]);
    const cart = fixture("cart-items");
    cart[0]!.added_by = actor;
    cart[0]!.checked_by = actor;
    cart[0]!.is_checked = true;
    state.context.values.set("cart-items", cart);
    await withdrawAccount();
    expect(state.context.values.get("events")).toEqual([
      { ...shared, owner_id: null },
    ]);
    expect(cart[0]).toMatchObject({
      added_by: null,
      checked_by: null,
      is_checked: true,
    });
    state.context.perspective = 1;
    expect((await getFamily())?.members).toHaveLength(1);
  });

  it("다른 관리자가 없으면 변경 없이 거부하고 권한을 넘긴 뒤 탈퇴해요", async () => {
    const other = family().members[1]!;
    other.role = "member";
    const events = structuredClone(state.context.values.get("events"));
    await expect(withdrawAccount()).rejects.toMatchObject({
      code: "last_admin",
    });
    expect(state.context.values.get("events")).toEqual(events);
    await changeMemberRole({ memberId: other.user_id, role: "admin" });
    await withdrawAccount();
    state.context.perspective = 1;
    expect((await getFamily())?.members).toEqual([other]);
  });

  it("다른 관리자의 역할은 바꾸지 못하고 본인만 내려올 수 있어요", async () => {
    await expect(
      changeMemberRole({
        memberId: family().members[1]!.user_id,
        role: "member",
      }),
    ).rejects.toMatchObject({ code: "role_forbidden" });
    await changeMemberRole({
      memberId: family().members[0]!.user_id,
      role: "member",
    });
    await expect(
      changeMemberRole({
        memberId: family().members[1]!.user_id,
        role: "child",
      }),
    ).rejects.toMatchObject({ code: "role_forbidden" });
  });

  it("마지막 관리자는 스스로 내려올 수 없고 다른 가정의 역할도 바꾸지 못해요", async () => {
    family().members[1]!.role = "child";
    await expect(
      changeMemberRole({
        memberId: family().members[0]!.user_id,
        role: "member",
      }),
    ).rejects.toMatchObject({ code: "last_admin" });
    await expect(
      changeMemberRole({ memberId: crypto.randomUUID(), role: "admin" }),
    ).rejects.toMatchObject({ code: "member_not_found" });
  });

  it("안 쓴 초대는 지우고 쓴 초대는 사용 상태를 유지하며 작성자를 비워요", async () => {
    const actor = family().members[0]!.user_id;
    const invitation = fixture("invites")[0]!;
    state.context.values.set("invites", [
      {
        ...invitation,
        token: crypto.randomUUID(),
        used: false,
        createdBy: actor,
      },
      { ...invitation, used: true, createdBy: actor, acceptedBy: actor },
    ]);
    await withdrawAccount();
    expect(state.context.values.get("invites")).toEqual([
      { ...invitation, used: true, createdBy: null, acceptedBy: null },
    ]);
  });

  it("마지막 구성원이 탈퇴하면 가정 데이터를 지워요", async () => {
    await withdrawAccount();
    state.context.perspective = 1;
    await withdrawAccount();
    for (const name of ["events", "cart-items", "inventory-items", "invites"]) {
      expect(state.context.values.get(name)).toEqual([]);
    }
  });

  it("실제 DB 경로는 사용자 ID 인자 없이 탈퇴 RPC를 호출해요", async () => {
    state.live = true;
    await withdrawAccount();
    expect(state.rpc).toHaveBeenCalledWith("withdraw_account");
  });
});
