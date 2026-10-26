import { request } from "@/shared/api";
import { inventoryRoutes } from "@/shared/config";
import type { InventoryItem, InventoryMeta } from "./type";
export const fetchInventory = () =>
  request<InventoryItem[]>(inventoryRoutes.api);
export const fetchInventoryMeta = () =>
  request<InventoryMeta>(inventoryRoutes.metaApi);
export const mutateInventory = (input: unknown) =>
  request<string>(inventoryRoutes.api, input);
export const mutateInventoryMeta = (input: unknown) =>
  request<null>(inventoryRoutes.metaApi, input);
