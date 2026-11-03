import type { AgentAction } from "../../src/entities/chat-message/model/chat.schema.ts";
import type { AgentContext } from "./hermes.mts";
// Revisions come from the server snapshot, never from model-generated values.
export function withSnapshotChecks(
  actions: AgentAction[],
  context: Pick<AgentContext, "events" | "cart" | "inventory">,
): AgentAction[] {
  const revisions: Record<string, string> = {};
  for (const item of [
    ...context.events,
    ...context.cart,
    ...context.inventory,
  ]) {
    const id = item.seriesId ?? item.id;
    if (
      typeof id === "string" &&
      typeof item.revision === "string" &&
      /^[a-f0-9]{32}$/.test(item.revision)
    )
      revisions[id] = item.revision;
  }
  return actions.map((action) => ({ ...action, expected: revisions }));
}
