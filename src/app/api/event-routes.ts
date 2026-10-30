import "server-only";
import { after } from "next/server";
import { dispatchPendingPush } from "@/entities/notification/index.server";
import { authenticatedClient } from "@/entities/user/index.server";
import {
  listDdayDismissals,
  dismissDdayCard,
  listEvents,
  getEvent,
  saveEvent,
  deleteEvent,
  listEventCategories,
  saveEventCategory,
  deleteEventCategory,
} from "@/entities/event/index.server";
import {
  isServerMockDataEnabled,
  handleRoute,
  readJson,
} from "@/shared/server";

async function withPush<T>(action: () => Promise<T>) {
  const result = await action();
  if (!(await isServerMockDataEnabled()))
    after(async () => {
      try {
        await dispatchPendingPush();
      } catch {
        console.error("event_push_dispatch_failed");
      }
    });
  return result;
}

type Context = { params: Promise<{ id: string }> };
async function authorized<T>(
  action: (
    auth?: Awaited<ReturnType<typeof authenticatedClient>>,
  ) => Promise<T>,
) {
  const auth = (await isServerMockDataEnabled())
    ? undefined
    : await authenticatedClient();
  return action(auth);
}
export function eventsGET(request: Request) {
  return handleRoute(request, () => {
    const params = new URL(request.url).searchParams;
    const start = params.get("start");
    const end = params.get("end");
    return authorized((auth) =>
      listEvents(
        auth,
        start !== null || end !== null
          ? { start: start ?? "", end: end ?? "" }
          : undefined,
      ),
    );
  });
}
export function eventsPOST(request: Request) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      withPush(async () => saveEvent(await readJson(request), null, auth)),
    ),
  );
}
export function eventGET(request: Request, context: Context) {
  return handleRoute(request, () =>
    authorized(async (auth) => getEvent((await context.params).id, auth)),
  );
}
export function eventPOST(request: Request, context: Context) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      withPush(async () =>
        saveEvent(await readJson(request), (await context.params).id, auth),
      ),
    ),
  );
}
export function eventDeletePOST(request: Request, context: Context) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      withPush(async () =>
        deleteEvent((await context.params).id, auth, await readJson(request)),
      ),
    ),
  );
}
export function categoriesGET(request: Request) {
  return handleRoute(request, () => authorized(listEventCategories));
}
export function categoriesPOST(request: Request) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      saveEventCategory(await readJson(request), null, auth),
    ),
  );
}
export function categoryPOST(request: Request, context: Context) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      saveEventCategory(
        await readJson(request),
        (await context.params).id,
        auth,
      ),
    ),
  );
}
export function categoryDeletePOST(request: Request, context: Context) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      deleteEventCategory((await context.params).id, auth),
    ),
  );
}

export function ddayDismissalsGET(request: Request) {
  return handleRoute(request, () => authorized(listDdayDismissals));
}
export function ddayDismissPOST(request: Request, context: Context) {
  return handleRoute(request, () =>
    authorized(async (auth) =>
      dismissDdayCard((await context.params).id, auth),
    ),
  );
}
