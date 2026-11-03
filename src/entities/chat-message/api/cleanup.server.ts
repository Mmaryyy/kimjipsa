import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, type Database } from "@/shared/api";
import { getSupabaseConfig } from "@/shared/config";
import { throwDatabaseError } from "@/shared/server";
export async function cleanupAgentFiles(request: Request) {
  const expected = Buffer.from(process.env.CRON_SECRET ?? "");
  const actual = Buffer.from(request.headers.get("x-cron-secret") ?? "");
  if (
    !expected.length ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    throw new ApiError("forbidden", "인증이 필요해요.", 401);
  const { url, key } = getSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Storage cleanup credential missing");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const client = createClient<Database>(url, key, options);
  const storage = createClient(url, serviceKey, options).storage.from(
    "chat-attachments",
  );
  const listed = await client.rpc("agent_cleanup", {
    worker_secret: expected.toString(),
    operation: "list",
  });
  throwDatabaseError(listed.error);
  const paths = z.array(z.string()).parse(listed.data);
  if (paths.length) {
    const removed = await storage.remove(paths);
    if (removed.error) throw new Error("Storage deletion failed");
    const marked = await client.rpc("agent_cleanup", {
      worker_secret: expected.toString(),
      operation: "deleted",
      input: { paths },
    });
    throwDatabaseError(marked.error);
  }
  return { deleted: paths.length };
}
