import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  agentReadSchema,
  type AgentReadInput,
} from "../../src/entities/chat-message/model/agent-read.schema.ts";

export type HouseholdReader = (input: AgentReadInput) => Promise<unknown>;

function reply(response: ServerResponse, status: number, body: unknown) {
  response
    .writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    })
    .end(JSON.stringify(body));
}

export async function readToolRequest(
  request: IncomingMessage,
  response: ServerResponse,
  token: string,
  reader: HouseholdReader | null,
) {
  const supplied = Buffer.from(request.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  if (
    request.method !== "POST" ||
    request.headers.origin ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    reply(response, 403, { ok: false, error: "forbidden" });
    return;
  }
  if (!reader) {
    reply(response, 503, { ok: false, error: "gateway_unavailable" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const bytes = Buffer.from(chunk as Uint8Array);
      size += bytes.length;
      if (size > 2048) {
        reply(response, 413, { ok: false, error: "request_too_large" });
        return;
      }
      chunks.push(bytes);
    }
    const input = agentReadSchema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!input.success) {
      reply(response, 400, { ok: false, error: "invalid_request" });
      return;
    }
    const data = await reader(input.data);
    reply(response, 200, { ok: true, data });
  } catch {
    reply(response, 502, { ok: false, error: "read_unavailable" });
  }
}
