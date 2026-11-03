import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { homedir } from "node:os";
const execute = promisify(execFile);
export const gatewayRoot = fileURLToPath(new URL("../", import.meta.url));
export const configSchema = z.object({
  appUrl: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname))
    );
  }),
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(1),
  workerEmail: z.email(),
  keychainService: z.string().default("kimjipsa-ai-gateway"),
  hermesCommand: z.string().min(1),
  hermesPython: z.string().min(1),
  hermesSource: z.string().min(1).default(`${homedir()}/.hermes/hermes-agent`),
  hermesProfile: z.string().min(1),
  hermesPort: z.number().int().min(1024).max(65535).default(8643),
});
export type GatewayConfig = z.infer<typeof configSchema>;
export async function loadConfig() {
  return configSchema.parse(
    JSON.parse(await readFile(`${gatewayRoot}config.local.json`, "utf8")),
  );
}
export async function workerPassword(config: GatewayConfig) {
  // Credentials remain in Keychain; never place them in argv or log subprocess errors.
  try {
    return (
      await execute("/usr/bin/security", [
        "find-generic-password",
        "-s",
        config.keychainService,
        "-a",
        config.workerEmail,
        "-w",
      ])
    ).stdout.trim();
  } catch {
    throw new Error("worker_credential_missing");
  }
}
