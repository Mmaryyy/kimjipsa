import "server-only";
import { authenticatedClient } from "@/entities/user/index.server";
import {
  listInventory,
  listInventoryMeta,
  writeInventory,
  writeInventoryMeta,
} from "@/entities/inventory-item/index.server";
import {
  handleRoute,
  readJson,
  isServerMockDataEnabled,
} from "@/shared/server";
async function authorized<T>(action: () => Promise<T>) {
  if (!(await isServerMockDataEnabled())) await authenticatedClient();
  return action();
}
export function inventoryGET(request: Request) {
  return handleRoute(request, () => authorized(listInventory));
}
export function inventoryPOST(request: Request) {
  return handleRoute(request, () =>
    authorized(async () => writeInventory(await readJson(request))),
  );
}
export function inventoryMetaGET(request: Request) {
  return handleRoute(request, () => authorized(listInventoryMeta));
}
export function inventoryMetaPOST(request: Request) {
  return handleRoute(request, () =>
    authorized(async () => writeInventoryMeta(await readJson(request))),
  );
}
