import type { AgentAction } from "../../src/entities/chat-message/model/chat.schema.ts";
import type { AgentContext } from "./hermes.mts";
// Revisions come from the server snapshot, never from model-generated values.
export function withSnapshotChecks(
  actions: AgentAction[],
  context: Pick<
    AgentContext,
    "events" | "cart" | "inventory" | "projectSnapshots"
  >,
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
  const taskRevisions: Record<string, string> = {};
  for (const snapshot of context.projectSnapshots ?? []) {
    if (!("tasks" in snapshot)) continue;
    for (const task of snapshot.tasks) {
      if (/^[a-f0-9]{32}$/.test(task.revision))
        taskRevisions[task.id] = task.revision;
    }
  }
  return actions.map((action) => {
    if (action.domain !== "project") return { ...action, expected: revisions };
    const id = action.payload.id;
    return {
      ...action,
      expected:
        typeof id === "string" && taskRevisions[id]
          ? { [id]: taskRevisions[id] }
          : {},
    };
  });
}
