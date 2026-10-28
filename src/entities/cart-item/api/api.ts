import { request } from "@/shared/api";
import { cartRoutes } from "@/shared/config";
import type { CartData, CartCommand, CartWriteResult } from "./type";
export const fetchCart = () => request<CartData>(cartRoutes.api);
export const writeCart = (command: CartCommand) =>
  request<CartWriteResult>(cartRoutes.api, command);
