import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { Database, Json } from "../../src/shared/api/database.types.ts";
import {
  gatewayRoot,
  loadConfig,
  workerPassword,
  type GatewayConfig,
} from "./config.mts";
import {
  HermesRuntime,
  contextSchema,
  runtimeConfigSchema,
} from "./hermes.mts";
const jobSchema = z.object({
  id: z.uuid(),
  familyId: z.uuid(),
  leaseToken: z.uuid(),
  configVersion: z.number(),
  memoryVersion: z.number(),
  kind: z.enum(["chat", "summary"]),
  hermesRunId: z.string().nullable(),
});
const shutdown = new AbortController();
let state = "starting";
let activeJob: string | null = null;
let lastError: string | null = null;
const log = (event: string, code?: string) =>
  process.stdout.write(
    `${JSON.stringify({ at: new Date().toISOString(), event, jobId: activeJob, code })}\n`,
  );
const server = createServer((request, response) => {
  if (request.method !== "GET" || request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }
  response
    .writeHead(state === "ready" || state === "running" ? 200 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    .end(JSON.stringify({ state, jobId: activeJob, code: lastError }));
});
const listening = new Promise<boolean>((resolve) => {
  server.once("error", () => {
    log("startup_failed", "health_port_unavailable");
    shutdown.abort();
    process.exitCode = 1;
    resolve(false);
  });
  server.listen(8644, "127.0.0.1", () => {
    log("listening");
    resolve(true);
  });
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => shutdown.abort());
async function agentRpc(
  client: SupabaseClient<Database>,
  operation: string,
  input: Json = {},
) {
  const result = await client.rpc("agent_command", { operation, input });
  if (result.error) {
    const allowed = [
      "lease_lost",
      "attachment_expired",
      "forbidden",
      "confirmation_required",
      "invalid_inventory",
    ];
    throw new Error(
      allowed.includes(result.error.message)
        ? result.error.message
        : "cloud_unavailable",
    );
  }
  return result.data;
}
async function runConnected(config: GatewayConfig) {
  const client = createClient<Database>(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: { persistSession: false, autoRefreshToken: true },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([
              shutdown.signal,
              AbortSignal.timeout(15000),
            ]),
          }),
      },
    },
  );
  const password = await workerPassword(config);
  const authenticated = await client.auth.signInWithPassword({
    email: config.workerEmail,
    password,
  });
  if (authenticated.error || !authenticated.data.user)
    throw new Error("worker_auth_failed");
  const workerId = authenticated.data.user.id;
  const hermes = new HermesRuntime(config);
  let processing = false;
  let rerun = false;
  const rpc = (operation: string, input: Json = {}) =>
    agentRpc(client, operation, input);
  async function cloudConfig() {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) throw new Error("worker_auth_failed");
    const response = await fetch(new URL("/api/agent/config", config.appUrl), {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(15000)]),
      redirect: "error",
    });
    const envelope = z
      .object({ ok: z.boolean(), data: z.unknown() })
      .parse(await response.json());
    if (!response.ok || !envelope.ok) throw new Error("worker_config_failed");
    const result = runtimeConfigSchema.safeParse(envelope.data);
    if (!result.success) throw new Error("gateway_migration_required");
    return result.data;
  }
  async function drain() {
    if (processing) {
      rerun = true;
      return;
    }
    processing = true;
    try {
      do {
        rerun = false;
        shutdown.signal.throwIfAborted();
        const runtime = await cloudConfig();
        await hermes.ready(shutdown.signal);
        const raw = await rpc("claim");
        if (raw === null) {
          state = "ready";
          lastError = null;
          break;
        }
        const job = jobSchema.parse(raw);
        activeJob = job.id;
        state = "running";
        log("job_started");
        const controller = new AbortController();
        const signal = AbortSignal.any([controller.signal, shutdown.signal]);
        const input = { jobId: job.id, leaseToken: job.leaseToken };
        let heartbeatBusy = false;
        let admitted = false;
        const heartbeat = setInterval(() => {
          if (heartbeatBusy) return;
          heartbeatBusy = true;
          void rpc("heartbeat", input)
            .catch(() => controller.abort())
            .finally(() => {
              heartbeatBusy = false;
            });
        }, 20000);
        try {
          if (runtime.version !== job.configVersion)
            throw new Error("configuration_changed");
          const context = contextSchema.parse(await rpc("context", input));
          const images: Array<{ mimeType: string; base64: string }> = [];
          for (const attachment of context.attachments) {
            signal.throwIfAborted();
            const photo = await client.storage
              .from("chat-attachments")
              .download(attachment.path);
            if (photo.error || !photo.data || photo.data.size > 1048576)
              throw new Error("attachment_expired");
            images.push({
              mimeType: attachment.mime_type,
              base64: Buffer.from(await photo.data.arrayBuffer()).toString(
                "base64",
              ),
            });
          }
          const result = await hermes.run(
            job.id,
            runtime,
            context,
            images,
            signal,
            async (id) => {
              admitted = true;
              await rpc("heartbeat", { ...input, hermesRunId: id });
            },
          );
          signal.throwIfAborted();
          if (images.length && result.kind === "add")
            throw new Error("confirmation_required");
          await rpc("complete", { ...input, ...result });
          log("job_completed");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "execution_unknown";
          const known = [
            "gateway_auth_required",
            "ai_quota_exceeded",
            "invalid_response",
            "attachment_expired",
            "model_unavailable",
            "invalid_inventory",
            "confirmation_required",
            "configuration_changed",
          ];
          const code = known.includes(message)
            ? message
            : admitted || signal.aborted
              ? "execution_unknown"
              : "hermes_unavailable";
          await rpc("fail", { ...input, code }).catch(() => {});
          lastError = code;
          log("job_stopped", code);
        } finally {
          clearInterval(heartbeat);
          await hermes.stop();
          activeJob = null;
        }
        rerun = true;
      } while (rerun && !shutdown.signal.aborted);
    } catch (error) {
      state = "disconnected";
      const code = error instanceof Error ? error.message : "";
      lastError = [
        "worker_auth_failed",
        "worker_config_failed",
        "gateway_migration_required",
        "local_model_configuration_failed",
        "hermes_start_failed",
        "hermes_tools_enabled",
        "hermes_tool_policy_unknown",
        "forbidden",
        "cloud_unavailable",
      ].includes(code)
        ? code
        : "cloud_unavailable";
      log("connection_unavailable", lastError);
    } finally {
      processing = false;
    }
  }
  const channel = client
    .channel(`worker:${workerId}:jobs`, { config: { private: true } })
    .on("broadcast", { event: "*" }, () => void drain())
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void drain();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        state = "disconnected";
    });
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    if (session) void client.realtime.setAuth(session.access_token);
  });
  // Correct missed notifications after reconnect/completion; one low-frequency safety sweep.
  const reconcile = setInterval(() => void drain(), 60000);
  try {
    await delay(2147483647, undefined, { signal: shutdown.signal });
  } finally {
    clearInterval(reconcile);
    subscription.unsubscribe();
    await client.removeChannel(channel);
    client.auth.stopAutoRefresh();
    while (processing) await delay(50);
    await hermes.stop();
  }
}
const bound = await listening;
await mkdir(`${gatewayRoot}.runtime`, { recursive: true, mode: 0o700 });
if (bound)
  await writeFile(`${gatewayRoot}.runtime/worker.pid`, String(process.pid), {
    mode: 0o600,
  });
try {
  while (!shutdown.signal.aborted) {
    try {
      const config = await loadConfig();
      await runConnected(config);
    } catch (error) {
      if (shutdown.signal.aborted) break;
      state = "waiting_configuration";
      const code =
        error instanceof Error &&
        ["worker_credential_missing", "worker_auth_failed"].includes(
          error.message,
        )
          ? error.message
          : "configuration_required";
      if (lastError !== code) {
        lastError = code;
        log("configuration_required", code);
      }
      await delay(30000, undefined, { signal: shutdown.signal }).catch(
        () => {},
      );
    }
  }
} finally {
  server.close();
  log("stopped");
}
