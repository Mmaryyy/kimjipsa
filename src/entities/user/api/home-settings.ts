import { request } from "@/shared/api";
import { homeSettingsApiPath } from "@/shared/config";
import type { HomeSettings } from "../model/home-settings.schema";
export function fetchHomeSettings() {
  return request<HomeSettings>(homeSettingsApiPath);
}
export function saveHomeSettings(settings: HomeSettings) {
  return request<null>(homeSettingsApiPath, settings);
}
