// @vitest-environment node
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { scheduledNotifications } from "../lib/schedule.utils";

// Opt in only against a disposable, migrated local Supabase database with psql.
const databaseUrl = process.env.KIMJIPSA_TEST_DATABASE_URL;
function quote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}
async function sql(statement: string) {
  if (
    !databaseUrl ||
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)
  )
    throw new Error("폐기 가능한 로컬 테스트 DB만 사용할 수 있어요.");
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "psql",
      [databaseUrl, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
      {
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let output = "";
    let failure = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      failure += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(output.trim()) : reject(new Error(failure)),
    );
    child.stdin.end(statement);
  });
}
it.skipIf(!databaseUrl)(
  "CAL-11 ACC-11 SCN-CAL-5 SQL 동시 중복 방지·새 시작 키·endpoint 소유권",
  async () => {
    const owner = randomUUID();
    const spouse = randomUUID();
    const family = randomUUID();
    const eventId = randomUUID();
    const endpoint = `https://web.push.apple.com/${randomUUID()}`;
    let secret = await sql(
      "select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret';",
    );
    let secretId: string | undefined;
    if (!secret) {
      secret = randomBytes(32).toString("hex");
      secretId = await sql(
        `select vault.create_secret(${quote(secret)}, 'cron_secret');`,
      );
    }
    const call = (input: unknown) =>
      `select public.notification_worker(${quote(secret)}, 'schedule', ${quote(JSON.stringify(input))}::jsonb);`;
    try {
      await sql(`
      begin;
      insert into auth.users(id) values ('${owner}'), ('${spouse}');
      insert into public.users(id, provider, provider_user_id, display_name,
        terms_accepted_at, privacy_accepted_at, terms_version)
        values ('${owner}', 'google', '${owner}', '본인', now(), now(), 'test'),
               ('${spouse}', 'google', '${spouse}', '배우자', now(), now(), 'test');
      insert into public.families(id, name) values ('${family}', '테스트가정');
      insert into public.memberships(user_id, family_id, role)
        values ('${owner}', '${family}', 'admin'), ('${spouse}', '${family}', 'member');
      insert into public.events(id, family_id, owner_id, start_date, end_date, start_time)
        values ('${eventId}', '${family}', '${owner}', '2026-10-22', '2026-10-22', '14:00');
      insert into public.event_details(event_id, family_id, title, category_id)
        select '${eventId}', '${family}', 'SQL 알림', id from public.event_categories
        where family_id = '${family}' limit 1;
      commit;
    `);
      const event = {
        id: eventId,
        familyId: family,
        ownerId: owner,
        visibility: "private" as const,
        kind: "event" as const,
        title: "SQL 알림",
        startDate: "2026-10-22",
        endDate: "2026-10-22",
        startTime: "14:00:00",
        isAllDay: false,
        remindBefore: 30,
      };
      const snapshot = {
        users: [{ id: owner, familyId: family, morningTime: "10:00" }],
        events: [event],
        now: "2026-10-22T04:30:00Z",
      };
      const candidate = scheduledNotifications(snapshot)[0]!;
      // Hold the transaction after scheduling so a second connection contends on the same lock.
      const results = await Promise.all([
        sql(`begin; ${call(candidate)} select pg_sleep(0.3); commit;`),
        sql(`begin; ${call(candidate)} commit;`),
      ]);
      expect(results.filter((result) => result.includes("null"))).toHaveLength(
        1,
      );
      expect(
        await sql(
          `select count(*) from public.notifications where user_id = '${owner}';`,
        ),
      ).toBe("1");
      expect(
        await sql(
          `select count(*) from private.notification_schedule_log where dedupe_key = ${quote(candidate.key)};`,
        ),
      ).toBe("1");
      await sql(
        `update public.events set start_time = '15:00' where id = '${eventId}';`,
      );
      const changed = scheduledNotifications({
        ...snapshot,
        now: "2026-10-22T05:30:00Z",
        events: [{ ...event, startTime: "15:00:00" }],
      })[0]!;
      await sql(call(changed));
      expect(
        await sql(
          `select count(*) from public.notifications where user_id = '${owner}';`,
        ),
      ).toBe("2");
      const keys = quote(
        JSON.stringify({ p256dh: "b".repeat(87), auth: "a".repeat(22) }),
      );
      await sql(`set role authenticated; set request.jwt.claim.sub = '${owner}';
      insert into public.push_subscriptions(user_id, endpoint, keys)
        values ('${owner}', ${quote(endpoint)}, ${keys}::jsonb);`);
      await expect(
        sql(`set role authenticated; set request.jwt.claim.sub = '${spouse}';
      insert into public.push_subscriptions(user_id, endpoint, keys)
        values ('${spouse}', ${quote(endpoint)}, ${keys}::jsonb)
      on conflict(endpoint) do update set user_id = excluded.user_id, keys = excluded.keys;`),
      ).rejects.toThrow(/row-level security/i);
      expect(
        await sql(
          `select user_id from public.push_subscriptions where endpoint = ${quote(endpoint)};`,
        ),
      ).toBe(owner);
      const retryEndpoint = `${endpoint}/retry`;
      await sql(`
        update public.users set push_enabled = true where id = '${owner}';
        insert into public.push_subscriptions(user_id, endpoint, keys)
          values ('${owner}', ${quote(retryEndpoint)}, ${keys}::jsonb);
      `);
      const workerCall = (operation: string, input: unknown = {}) =>
        `select public.notification_worker(${quote(secret)}, ${quote(operation)}, ${quote(JSON.stringify(input))}::jsonb);`;
      const pending = JSON.parse(await sql(workerCall("claim_push"))) as {
        id: string;
        user_id: string;
        subscriptions: { endpoint: string }[];
      }[];
      const claimed = pending.filter((entry) => entry.user_id === owner);
      expect(claimed).toHaveLength(2);
      expect(claimed[0]!.subscriptions).toHaveLength(2);
      const notificationId = claimed[0]!.id;
      expect(JSON.parse(await sql(workerCall("claim_push")))).toEqual([]);
      await sql(
        workerCall("release_push", {
          notificationId,
          endpoint: retryEndpoint,
        }),
      );
      const retry = JSON.parse(await sql(workerCall("claim_push")));
      expect(retry).toEqual([
        expect.objectContaining({
          id: notificationId,
          subscriptions: [expect.objectContaining({ endpoint: retryEndpoint })],
        }),
      ]);
      await sql(
        workerCall("release_push", {
          notificationId,
          endpoint: retryEndpoint,
        }),
      );
      await sql(`update public.notifications set created_at = now() - interval '6 minutes'
        where id = '${notificationId}';`);
      expect(JSON.parse(await sql(workerCall("claim_push")))).toEqual([]);
    } finally {
      await sql(`delete from public.events where id = '${eventId}';
      delete from public.families where id = '${family}';
      delete from auth.users where id in ('${owner}', '${spouse}');`);
      if (secretId)
        await sql(
          `delete from vault.secrets where id = ${quote(secretId)}::uuid;`,
        );
    }
  },
  20000,
);
