import { request } from "@/shared/api";
import { accountApiRoutes, inviteApiPath } from "@/shared/config";
import type { Family, Invitation, InvitePreview } from "@/entities/family";
export function fetchFamily() {
  return request<Family | null>(accountApiRoutes.family);
}
export function createFamily(name: string) {
  return request<string>(accountApiRoutes.family, { name });
}
export function createInvite() {
  return request<Invitation>(accountApiRoutes.invites, {});
}
export function fetchInvite(token: string) {
  return request<InvitePreview>(inviteApiPath(token));
}
export function acceptInvite(token: string) {
  return request<string>(inviteApiPath(token), {});
}
