import "server-only";
import {
  getHomeSettings,
  saveHomeSettings,
} from "@/entities/user/index.server";
import { handleRoute, readJson } from "@/shared/server";
export function homeSettingsGET(request: Request) {
  return handleRoute(request, getHomeSettings);
}
export function homeSettingsPOST(request: Request) {
  return handleRoute(request, async () =>
    saveHomeSettings(await readJson(request)),
  );
}
