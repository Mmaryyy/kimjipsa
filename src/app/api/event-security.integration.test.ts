// @vitest-environment node
import type * as SharedServer from "@/shared/server";
import { eventCategoryColors } from "@/entities/event";
import { randomUUID } from "node:crypto";
import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Database } from "@/shared/api";
import { getEvent, listEvents, saveEvent } from "@/entities/event/index.server";
const { requesterClient } = vi.hoisted(() => ({ requesterClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/server", async (original) => ({
  ...(await original<typeof SharedServer>()),
  createServerSupabaseClient: requesterClient,
}));
const localUrl = process.env.SUPABASE_TEST_URL;
const run = localUrl ? describe : describe.skip;
type Client = SupabaseClient<Database>;
const sessionOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};
const channels: RealtimeChannel[] = [];
const users: string[] = [];
const families: string[] = [];
let admin: Client;
let owner: Client;
let spouse: Client;
let outsider: Client;
let familyId: string;
let categoryId: string;
let fallbackId: string;
let ownerId: string;
let spouseId: string;
async function createActor(url: string, anonKey: string) {
  const email = `${randomUUID()}@canary.invalid`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error("로컬 canary 사용자 생성 실패");
  const id = created.data.user.id;
  users.push(id);
  const profile = await admin.from("users").insert({
    id,
    provider: "google",
    provider_user_id: id,
    display_name: "검증",
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
    terms_version: "test",
  });
  if (profile.error) throw profile.error;
  const client = createClient<Database>(url, anonKey, sessionOptions);
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw new Error("로컬 canary 세션 생성 실패");
  return { client, id };
}
function saveArgs(visibility = "private") {
  return {
    event_id: null as string | null,
    event_title: "CANARY_TITLE",
    event_place: "CANARY_PLACE",
    event_memo: "CANARY_MEMO",
    event_category_id: categoryId,
    event_visibility: visibility,
    event_start_date: "2026-10-16",
    event_end_date: "2026-10-16",
    event_start_time: "15:00",
    event_end_time: "16:00",
    event_is_all_day: false,
  };
}
async function createEvent(visibility = "private") {
  const result = await owner.rpc("save_event", saveArgs(visibility));
  expect(result.error).toBeNull();
  return z.uuid().parse(result.data);
}
async function subscribe(channel: RealtimeChannel, allowRejection = false) {
  channels.push(channel);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("로컬 Realtime 구독 시간 초과")),
      10000,
    );
    channel.subscribe((status) => {
      if (
        status === "SUBSCRIBED" ||
        (allowRejection && status === "CHANNEL_ERROR")
      ) {
        clearTimeout(timeout);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error("로컬 Realtime 구독 실패"));
      }
    });
  });
}
run(
  "CAL-01~05·08 ACC-13 SCN-CAL-1~3 로컬 DB/RLS/Realtime canary (SUPABASE_TEST_URL 필요)",
  () => {
    beforeAll(async () => {
      const url = new URL(localUrl!);
      if (
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      ) {
        throw new Error("canary는 로컬 Supabase에서만 실행할 수 있어요.");
      }
      const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
      const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
      if (!anonKey || !serviceKey)
        throw new Error("로컬 canary 환경 변수 세 개를 모두 설정해 주세요.");
      admin = createClient<Database>(url.origin, serviceKey, sessionOptions);
      const ownerActor = await createActor(url.origin, anonKey);
      const spouseActor = await createActor(url.origin, anonKey);
      const outsiderActor = await createActor(url.origin, anonKey);
      owner = ownerActor.client;
      ownerId = ownerActor.id;
      spouse = spouseActor.client;
      spouseId = spouseActor.id;
      outsider = outsiderActor.client;
      const family = await owner.rpc("create_family", {
        family_name: "검증가정",
      });
      expect(family.error).toBeNull();
      familyId = z.uuid().parse(family.data);
      families.push(familyId);
      const membership = await admin
        .from("memberships")
        .insert({ user_id: spouseId, family_id: familyId, role: "admin" });
      expect(membership.error).toBeNull();
      const otherFamily = await outsider.rpc("create_family", {
        family_name: "다른가정",
      });
      expect(otherFamily.error).toBeNull();
      families.push(z.uuid().parse(otherFamily.data));
      const categories = await owner
        .from("event_categories")
        .select("id, name, sort_order")
        .order("sort_order");
      expect(categories.error).toBeNull();
      expect(categories.data?.map((category) => category.name).sort()).toEqual(
        ["검증가정", "회사", "가족", "약속", "병원", "기타"].sort(),
      );
      expect(categories.data?.map((category) => category.name)).toEqual([
        "검증가정",
        "가족",
        "기타",
        "병원",
        "약속",
        "회사",
      ]);
      categoryId = categories.data!.find(
        (category) => category.name === "병원",
      )!.id;
      fallbackId = categories.data!.find(
        (category) => category.name === "기타",
      )!.id;
    }, 30000);
    afterAll(async () => {
      for (const channel of channels) await spouse?.removeChannel(channel);
      if (!admin) return;
      // Only fixture IDs created by this run are removed, and only on loopback.
      for (const id of families)
        await admin.from("families").delete().eq("id", id);
      for (const id of users) await admin.auth.admin.deleteUser(id);
    });
    it("CAL-09 SCN-CAL-5 공유 변경·삭제 알림은 같은 가정의 변경자 외에만 남아요", async () => {
      const id = await createEvent("shared");
      const changed = await owner.rpc("save_event", {
        ...saveArgs("shared"),
        event_id: id,
        event_title: "변경한 공유 일정",
        event_remind_before: 60,
      });
      expect(changed.error).toBeNull();
      const removed = await owner.rpc("delete_event", { event_id: id });
      expect(removed.error).toBeNull();
      const notices = await spouse
        .from("notifications")
        .select("*")
        .contains("payload", { eventId: id });
      expect(notices.error).toBeNull();
      expect(notices.data?.map((row) => row.kind).sort()).toEqual([
        "event_created",
        "event_deleted",
        "event_updated",
      ]);
      expect(JSON.stringify(notices.data)).not.toContain("CANARY_MEMO");
      expect(JSON.stringify(notices.data)).not.toContain("CANARY_PLACE");
      for (const actor of [owner, outsider]) {
        const invisible = await actor
          .from("notifications")
          .select("id")
          .contains("payload", { eventId: id });
        expect(invisible.error).toBeNull();
        expect(invisible.data).toEqual([]);
      }
      const notificationId = notices.data![0]!.id;
      const foreignRead = await owner
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .select("id");
      expect(foreignRead.data).toEqual([]);
      const ownRead = await spouse
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .select("read_at");
      expect(ownRead.error).toBeNull();
      expect(ownRead.data?.[0]?.read_at).not.toBeNull();
      const forged = await spouse.from("notifications").insert({
        user_id: spouseId,
        family_id: familyId,
        kind: "event_created",
        payload: { eventId: id },
      });
      expect(forged.error).not.toBeNull();
      const contentWrite = await spouse
        .from("notifications")
        .update({ payload: { eventId: id, eventTitle: "위조" } })
        .eq("id", notificationId);
      expect(contentWrite.error).not.toBeNull();
    });
    it("CAL-09 SCN-CAL-5 개인 전환은 이전 알림 제목을 지우고 삭제 표시도 남겨요", async () => {
      const id = await createEvent("shared");
      expect(
        (await owner.rpc("save_event", { ...saveArgs(), event_id: id })).error,
      ).toBeNull();
      const notices = await spouse
        .from("notifications")
        .select("payload")
        .contains("payload", { eventId: id });
      expect(notices.error).toBeNull();
      expect(notices.data).toHaveLength(1);
      expect(notices.data![0]!.payload).not.toHaveProperty("eventTitle");
      expect(
        (await owner.rpc("delete_event", { event_id: id })).error,
      ).toBeNull();
      const deleted = await spouse
        .from("notifications")
        .select("payload")
        .contains("payload", { eventId: id });
      expect(deleted.error).toBeNull();
      expect(deleted.data![0]!.payload).toMatchObject({ eventDeleted: true });
      expect(deleted.data![0]!.payload).not.toHaveProperty("eventTitle");
    });
    it("CAL-09 SCN-CAL-5 개인 일정 변경·삭제는 알림을 만들지 않아요", async () => {
      const id = await createEvent();
      expect(
        (await owner.rpc("save_event", { ...saveArgs(), event_id: id })).error,
      ).toBeNull();
      expect(
        (await owner.rpc("delete_event", { event_id: id })).error,
      ).toBeNull();
      const notices = await admin
        .from("notifications")
        .select("id")
        .contains("payload", { eventId: id });
      expect(notices.error).toBeNull();
      expect(notices.data).toEqual([]);
    });
    it("CAL-11 ACC-11 SCN-CAL-5 SCN-ACC-5 DB에서도 알림 값과 본인 설정을 검증해요", async () => {
      const id = await createEvent("shared");
      const before = await spouse
        .from("notifications")
        .select("id")
        .contains("payload", { eventId: id });
      const invalid = await owner.rpc("save_event", {
        ...saveArgs("shared"),
        event_id: id,
        event_remind_before: 20,
      });
      expect(invalid.error).not.toBeNull();
      const after = await spouse
        .from("notifications")
        .select("id")
        .contains("payload", { eventId: id });
      expect(after.data).toEqual(before.data);
      expect(
        (
          await owner
            .from("event_details")
            .select("remind_before")
            .eq("event_id", id)
            .single()
        ).data?.remind_before,
      ).toBe(30);
      expect(
        (
          await owner.rpc("save_event", {
            ...saveArgs("shared"),
            event_id: id,
            event_remind_before: null,
          })
        ).error,
      ).toBeNull();
      expect(
        (
          await owner
            .from("event_details")
            .select("remind_before")
            .eq("event_id", id)
            .single()
        ).data?.remind_before,
      ).toBeNull();
      expect(
        (
          await owner.rpc("save_notification_settings", {
            push_enabled: false,
            morning_summary_time: "08:30",
          })
        ).error,
      ).toBeNull();
      const settings = await owner
        .from("users")
        .select("push_enabled, morning_summary_time")
        .eq("id", ownerId)
        .single();
      expect(settings.data).toEqual({
        push_enabled: false,
        morning_summary_time: "08:30:00",
      });
      expect(
        (
          await owner.rpc("save_notification_settings", {
            push_enabled: true,
            morning_summary_time: "24:00",
          })
        ).error,
      ).not.toBeNull();
      const other = await spouse
        .from("users")
        .select("push_enabled, morning_summary_time")
        .eq("id", spouseId)
        .single();
      expect(other.data).toEqual({
        push_enabled: true,
        morning_summary_time: "10:00:00",
      });
    });
    it("SCN-CAL-2 개인 일정은 직접 조회·중첩 조회·서버 응답에서 내용과 카테고리가 없어요", async () => {
      const id = await createEvent();
      const own = await owner
        .from("event_details")
        .select("*")
        .eq("event_id", id);
      expect(own.error).toBeNull();
      expect(own.data?.[0]?.title).toBe("CANARY_TITLE");
      const direct = await spouse
        .from("event_details")
        .select("*")
        .eq("event_id", id);
      expect(direct.error).toBeNull();
      expect(direct.data).toEqual([]);
      const nested = await spouse
        .from("events")
        .select("*, event_details(*)")
        .eq("id", id);
      expect(nested.error).toBeNull();
      expect(nested.data).toHaveLength(1);
      expect(nested.data?.[0]?.event_details).toBeNull();
      expect(JSON.stringify(nested.data)).not.toContain("CANARY");
      requesterClient.mockResolvedValue(spouse);
      const response = (await listEvents()).find((event) => event.id === id);
      expect(response?.details).toBeNull();
      expect(response).not.toHaveProperty("remindBefore");
      expect(response?.canEdit).toBe(false);
      expect(JSON.stringify(response)).not.toContain("CANARY");
      expect(await getEvent(id)).toBeNull();
      requesterClient.mockResolvedValue(owner);
      expect((await getEvent(id))?.details?.title).toBe("CANARY_TITLE");
    });
    it("SCN-CAL-3 배우자는 개인 일정 수정·삭제를 못 하고 다른 가정은 시간도 못 봐요", async () => {
      const id = await createEvent();
      expect(
        (await spouse.rpc("save_event", { ...saveArgs(), event_id: id })).error
          ?.message,
      ).toBe("event_forbidden");
      expect(
        (await spouse.rpc("delete_event", { event_id: id })).error?.message,
      ).toBe("event_forbidden");
      const outside = await outsider.from("events").select("*").eq("id", id);
      expect(outside.error).toBeNull();
      expect(outside.data).toEqual([]);
      const outsideDetails = await outsider
        .from("event_details")
        .select("*")
        .eq("event_id", id);
      expect(outsideDetails.error).toBeNull();
      expect(outsideDetails.data).toEqual([]);
      const outsideCategories = await outsider
        .from("event_categories")
        .select("*")
        .eq("family_id", familyId);
      expect(outsideCategories.error).toBeNull();
      expect(outsideCategories.data).toEqual([]);
      expect(
        (await outsider.rpc("delete_event", { event_id: id })).error?.message,
      ).toBe("event_not_found");
      expect(
        (
          await spouse
            .from("event_details")
            .update({ title: "변조" })
            .eq("event_id", id)
        ).error,
      ).not.toBeNull();
    });
    it("SCN-CAL-1 공유 일정은 배우자도 수정·삭제하지만 개인 전환은 작성자만 해요", async () => {
      const id = await createEvent("shared");
      expect(
        (await spouse.from("event_details").select("title").eq("event_id", id))
          .data?.[0]?.title,
      ).toBe("CANARY_TITLE");
      expect(
        (
          await spouse.rpc("save_event", {
            ...saveArgs("shared"),
            event_id: id,
            event_title: "함께 수정",
          })
        ).error,
      ).toBeNull();
      expect(
        (await owner.from("event_details").select("title").eq("event_id", id))
          .data?.[0]?.title,
      ).toBe("함께 수정");
      expect(
        (await spouse.rpc("save_event", { ...saveArgs(), event_id: id })).error
          ?.message,
      ).toBe("event_forbidden");
      requesterClient.mockResolvedValue(spouse);
      await expect(
        saveEvent(
          {
            title: "전환",
            place: "",
            memo: "",
            categoryId,
            visibility: "private",
            startDate: "2026-10-16",
            endDate: "2026-10-16",
            startTime: null,
            endTime: null,
            isAllDay: false,
          },
          id,
        ),
      ).rejects.toMatchObject({ code: "event_forbidden" });
      expect(
        (await owner.rpc("save_event", { ...saveArgs(), event_id: id })).error,
      ).toBeNull();
      expect(
        (await listEvents()).find((event) => event.id === id)?.details,
      ).toBeNull();
      expect(await getEvent(id)).toBeNull();
      expect(
        (await spouse.from("event_details").select("*").eq("event_id", id))
          .data,
      ).toEqual([]);
      expect(
        (await owner.from("events").select("owner_id").eq("id", id)).data?.[0]
          ?.owner_id,
      ).toBe(ownerId);
      await owner.rpc("save_event", { ...saveArgs("shared"), event_id: id });
      expect(
        (await spouse.rpc("delete_event", { event_id: id })).error,
      ).toBeNull();
      expect(
        (await owner.from("event_details").select("*").eq("event_id", id)).data,
      ).toEqual([]);
    });
    it(
      "CAL-04 SCN-CAL-2 Realtime" +
        " INSERT·UPDATE·DELETE 페이로드에 개인 내용이 없어요",
      async () => {
        const receivedTimes: unknown[] = [];
        const receivedDetails: unknown[] = [];
        const timeChannel = spouse
          .channel(`canary-time-${randomUUID()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "events" },
            (payload) => receivedTimes.push(payload),
          );
        await subscribe(timeChannel);
        const detailChannel = spouse
          .channel(`canary-detail-${randomUUID()}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "event_details" },
            (payload) => receivedDetails.push(payload),
          );
        await subscribe(detailChannel, true);
        const id = await createEvent("shared");
        requesterClient.mockResolvedValue(spouse);
        expect((await getEvent(id))?.details?.title).toBe("CANARY_TITLE");
        await vi.waitFor(() => expect(receivedTimes).toHaveLength(1), {
          timeout: 10000,
        });
        expect(
          (
            await owner.rpc("save_event", {
              ...saveArgs(),
              event_id: id,
              event_title: "CANARY_CHANGED",
            })
          ).error,
        ).toBeNull();
        await vi.waitFor(() => expect(receivedTimes).toHaveLength(2), {
          timeout: 10000,
        });
        expect(receivedTimes[1]).toMatchObject({
          new: { id, visibility: "private" },
        });
        expect(JSON.stringify(receivedTimes[1])).not.toMatch(
          /CANARY|title|place|memo|category_id|remind_before/,
        );
        requesterClient.mockResolvedValue(spouse);
        const hidden = (await listEvents()).find((event) => event.id === id);
        expect(hidden?.details).toBeNull();
        expect(hidden?.canEdit).toBe(false);
        expect(await getEvent(id)).toBeNull();
        const nested = await spouse
          .from("events")
          .select("*, event_details(*)")
          .eq("id", id);
        expect(nested.error).toBeNull();
        expect(nested.data?.[0]?.event_details).toBeNull();
        expect(
          (await owner.rpc("delete_event", { event_id: id })).error,
        ).toBeNull();
        await vi.waitFor(() => expect(receivedTimes).toHaveLength(3), {
          timeout: 10000,
        });
        requesterClient.mockResolvedValue(spouse);
        expect((await listEvents()).some((event) => event.id === id)).toBe(
          false,
        );
        const privateId = await createEvent();
        await vi.waitFor(() => expect(receivedTimes).toHaveLength(4), {
          timeout: 10000,
        });
        expect(receivedTimes[3]).toMatchObject({
          new: { id: privateId, visibility: "private" },
        });
        expect(
          (await owner.rpc("delete_event", { event_id: privateId })).error,
        ).toBeNull();
        await vi.waitFor(() => expect(receivedTimes).toHaveLength(5), {
          timeout: 10000,
        });
        // Give an incorrectly published content stream time to arrive after the positive control.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(receivedDetails).toEqual([]);
        expect(JSON.stringify(receivedTimes)).not.toMatch(
          /CANARY|title|place|memo|category_id|remind_before/,
        );
        await spouse.removeChannel(timeChannel);
        await spouse.removeChannel(detailChannel);
      },
      40000,
    );
    it("CAL-08 ACC-13 카테고리 삭제는 개인·공유 일정 모두 기타로 옮기고 기타를 보호해요", async () => {
      const created = await owner.rpc("save_event_category", {
        category_id: null,
        category_name: "검증분류",
        category_color: Object.keys(eventCategoryColors)[0],
        category_sort_order: 1,
      });
      expect(created.error).toBeNull();
      const temporary = z.uuid().parse(created.data);
      expect(
        (
          await spouse.rpc("save_event_category", {
            category_id: temporary,
            category_name: "검증분류",
            category_color: Object.keys(eventCategoryColors)[0],
            category_sort_order: 0,
          })
        ).error,
      ).toBeNull();
      const ordered = await owner
        .from("event_categories")
        .select("id, sort_order")
        .order("sort_order");
      expect(ordered.error).toBeNull();
      expect(ordered.data?.[0]?.id).toBe(temporary);
      expect(ordered.data?.map((category) => category.sort_order)).toEqual([
        0, 1, 2, 3, 4, 5, 6,
      ]);
      const ids: string[] = [];
      for (const visibility of ["private", "shared"]) {
        const event = await owner.rpc("save_event", {
          ...saveArgs(visibility),
          event_category_id: temporary,
        });
        expect(event.error).toBeNull();
        ids.push(z.uuid().parse(event.data));
      }
      expect(
        (await spouse.rpc("delete_event_category", { category_id: temporary }))
          .error,
      ).toBeNull();
      const details = await owner
        .from("event_details")
        .select("category_id")
        .in("event_id", ids);
      expect(details.data).toEqual([
        { category_id: fallbackId },
        { category_id: fallbackId },
      ]);
      expect(
        (await owner.rpc("delete_event_category", { category_id: fallbackId }))
          .error?.message,
      ).toBe("fallback_category");
    });
  },
);
