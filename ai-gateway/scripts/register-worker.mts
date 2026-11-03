// Run explicitly after the database migration is approved and applied.
import { randomBytes, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { gatewayRoot } from "../src/config.mts";
const execute = promisify(execFile);
process.loadEnvFile(new URL("../../.env.local", import.meta.url));
const familyId = z.uuid().parse(process.argv[2]);
const serviceKey = z
  .string()
  .min(1)
  .parse(process.env.SUPABASE_SERVICE_ROLE_KEY);
const client = createClient(
  z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL),
  serviceKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const config = JSON.parse(
  await readFile(`${gatewayRoot}config.local.json`, "utf8"),
) as { workerEmail: string; keychainService: string };
const family = await client
  .from("families")
  .select("id")
  .eq("id", familyId)
  .single();
if (family.error) throw new Error("family_not_found");
const existing = await client
  .from("agent_workers")
  .select("id")
  .eq("family_id", familyId)
  .maybeSingle();
if (existing.error) throw new Error("apply_migration_first");
if (existing.data)
  throw new Error("worker_already_registered_use_existing_keychain_credential");
const password = randomBytes(32).toString("base64url");
config.workerEmail = `worker-${randomUUID()}@kimjipsa.invalid`;
const created = await client.auth.admin.createUser({
  email: config.workerEmail,
  password,
  email_confirm: true,
  app_metadata: { kimjipsa_worker: true },
});
if (created.error || !created.data.user)
  throw new Error("worker_registration_failed");
try {
  const inserted = await client
    .from("agent_workers")
    .insert({ id: created.data.user.id, family_id: familyId });
  if (inserted.error) throw new Error("worker_binding_failed");
  await execute("/usr/bin/security", [
    "add-generic-password",
    "-U",
    "-s",
    config.keychainService,
    "-a",
    config.workerEmail,
    "-w",
    password,
  ]);
  await writeFile(
    `${gatewayRoot}config.local.json`,
    JSON.stringify(config, null, 2) + "\n",
    { mode: 0o600 },
  );
  process.stdout.write("Worker registered; password stored in Keychain.\n");
} catch {
  await client.auth.admin.deleteUser(created.data.user.id);
  throw new Error("worker_setup_failed_registration_rolled_back");
}
