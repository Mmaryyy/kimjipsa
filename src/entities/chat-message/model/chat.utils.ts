import { uniqBy } from "lodash-es";
import type { Chat } from "./chat.schema";

export function mergeChatPages(pages: Chat[]): Chat | undefined {
  const version = Math.max(...pages.map((page) => page.sessionVersion));
  const current = pages.filter((page) => page.sessionVersion === version);
  const latest = current[0];
  if (!latest) return;
  return {
    ...latest,
    nextBefore: current.at(-1)!.nextBefore,
    messages: uniqBy(
      current.flatMap((page) => page.messages),
      "id",
    ).sort((left, right) => left.sequence - right.sequence),
    runs: uniqBy(
      current.flatMap((page) => page.runs),
      "id",
    ),
    receipts: uniqBy(
      current.flatMap((page) => page.receipts),
      "id",
    ),
    proposals: uniqBy(
      current.flatMap((page) => page.proposals),
      "id",
    ),
    attachments: uniqBy(
      current.flatMap((page) => page.attachments),
      "id",
    ),
  };
}
