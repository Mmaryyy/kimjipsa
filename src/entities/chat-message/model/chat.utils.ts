import { uniqBy } from "lodash-es";
import type { Chat } from "./chat.schema";

export function mergeChatPages(pages: Chat[]): Chat | undefined {
  const latest = pages[0];
  if (!latest) return;
  return {
    ...latest,
    nextBefore: pages.at(-1)!.nextBefore,
    messages: uniqBy(
      pages.flatMap((page) => page.messages),
      "id",
    ).sort((left, right) => left.sequence - right.sequence),
    runs: uniqBy(
      pages.flatMap((page) => page.runs),
      "id",
    ),
    receipts: uniqBy(
      pages.flatMap((page) => page.receipts),
      "id",
    ),
    proposals: uniqBy(
      pages.flatMap((page) => page.proposals),
      "id",
    ),
    attachments: uniqBy(
      pages.flatMap((page) => page.attachments),
      "id",
    ),
  };
}
