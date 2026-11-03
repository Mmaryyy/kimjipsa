import "server-only";
import {
  listChat,
  sendChat,
  cancelRun,
  confirmReceipt,
  getAiSettings,
  saveAiSettings,
  changeMemory,
  createAttachment,
  completeAttachment,
  readAttachment,
  getAgentConfig,
} from "@/entities/chat-message/index.server";
import { handleRoute, readJson } from "@/shared/server";
type IdContext = { params: Promise<{ id: string }> };
export function chatGET(request: Request) {
  return handleRoute(request, () =>
    listChat(new URL(request.url).searchParams.get("after")),
  );
}
export function chatPOST(request: Request) {
  return handleRoute(request, async () => sendChat(await readJson(request)));
}
export function settingsGET(request: Request) {
  return handleRoute(request, getAiSettings);
}
export function settingsPOST(request: Request) {
  return handleRoute(request, async () =>
    saveAiSettings(await readJson(request)),
  );
}
export function memoriesPOST(request: Request) {
  return handleRoute(request, async () =>
    changeMemory(await readJson(request)),
  );
}
export function attachmentsPOST(request: Request) {
  return handleRoute(request, async () =>
    createAttachment(await readJson(request)),
  );
}
export function attachmentPOST(request: Request, context: IdContext) {
  return handleRoute(request, async () =>
    completeAttachment((await context.params).id),
  );
}
export function attachmentGET(request: Request, context: IdContext) {
  return handleRoute(request, async () =>
    readAttachment((await context.params).id),
  );
}
export function runCancelPOST(request: Request, context: IdContext) {
  return handleRoute(request, async () => cancelRun((await context.params).id));
}
export function receiptConfirmPOST(request: Request, context: IdContext) {
  return handleRoute(request, async () =>
    confirmReceipt((await context.params).id, await readJson(request)),
  );
}
export function receiptCancelPOST(request: Request, context: IdContext) {
  return handleRoute(request, async () =>
    confirmReceipt((await context.params).id, await readJson(request), true),
  );
}
export function agentConfigGET(request: Request) {
  return handleRoute(request, () => getAgentConfig(request));
}
