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
  const storage = createClient(url, serviceKey, options).storage;
  const listed = await client.rpc("agent_cleanup", {
    worker_secret: expected.toString(),
    operation: "list",
  });
  throwDatabaseError(listed.error);
  const paths = z.array(z.string()).parse(listed.data);
  const projectPrefix = "project-photos:";
  const byBucket = Map.groupBy(paths, (path) =>
    path.startsWith(projectPrefix) ? "project-photos" : "chat-attachments",
  );
  for (const [bucket, queuedPaths] of byBucket) {
    const objectPaths =
      bucket === "project-photos"
        ? queuedPaths.map((path) => path.slice(projectPrefix.length))
        : queuedPaths;
    const removed = await storage.from(bucket).remove(objectPaths);
    if (removed.error) throw new Error("Storage deletion failed");
    const marked = await client.rpc("agent_cleanup", {
      worker_secret: expected.toString(),
      operation: "deleted",
      input: { paths: queuedPaths },
    });
    throwDatabaseError(marked.error);
  }
  return { deleted: paths.length };
}
