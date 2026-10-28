import "server-only";
import { listCart, writeCart } from "@/entities/cart-item/index.server";
import { handleRoute, readJson } from "@/shared/server";
export const cartGET = (request: Request) => handleRoute(request, listCart);
export const cartPOST = (request: Request) =>
  handleRoute(request, async () => writeCart(await readJson(request)));
