"use client";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchHomeSettings, saveHomeSettings } from "../api/home-settings";
const homeSettingsKey = ["home-settings"] as const;
export const homeSettingsQueryOptions = queryOptions({
  queryKey: homeSettingsKey,
  queryFn: fetchHomeSettings,
  staleTime: 30_000,
  retryOnMount: false,
});
export function useHomeSettings() {
  return useQuery(homeSettingsQueryOptions);
}
export function useSaveHomeSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveHomeSettings,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: homeSettingsKey }),
  });
}
