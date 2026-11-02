export const inventoryRoutes = {
  inventory: "/inventory",
  lists: "/settings/lists",
  api: "/api/inventory",
  metaApi: "/api/inventory-meta",
} as const;
export function inventoryListPath(kind: string, from?: "inventory" | "cart") {
  return `${inventoryRoutes.lists}?kind=${encodeURIComponent(kind)}${from ? `&from=${from}` : ""}`;
}
