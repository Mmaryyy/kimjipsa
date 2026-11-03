import { spawn } from "node:child_process";
import { z } from "zod";
import { gatewayRoot, type GatewayConfig } from "./config.mts";
import { searchSourceSchema } from "../../src/entities/chat-message/model/chat.schema.ts";
const resultsSchema = z
  .array(searchSourceSchema.extend({ description: z.string().max(2500) }))
  .max(5);
export async function searchWeb(
  config: GatewayConfig,
  query: string,
  message: string,
  signal: AbortSignal,
) {
  if (!query.trim() || query.length > 500 || !message.includes(query))
    throw new Error("invalid_response");
  if (signal.aborted) throw new Error("web_search_unavailable");
  return new Promise<z.infer<typeof resultsSchema>>((resolve, reject) => {
    const child = spawn(
      config.hermesPython,
      [`${gatewayRoot}scripts/search-web.py`, config.hermesSource],
      {
        cwd: gatewayRoot,
        env: {
          NODE_ENV: process.env.NODE_ENV ?? "production",
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LANG: "en_US.UTF-8",
          WEB_TOOLS_DEBUG: "false",
        },
        stdio: ["pipe", "pipe", "ignore"],
        signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      },
    );
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      if (output.length > 50000) child.kill();
    });
    child.once("error", () => reject(new Error("web_search_unavailable")));
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error("web_search_unavailable"));
      try {
        resolve(resultsSchema.parse(JSON.parse(output)));
      } catch {
        reject(new Error("web_search_unavailable"));
      }
    });
    child.stdin.once("error", () =>
      reject(new Error("web_search_unavailable")),
    );
    child.stdin.end(JSON.stringify({ query }));
  });
}
