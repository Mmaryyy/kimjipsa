"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchHomeSettings, saveHomeSettings } from "../api/home-settings";
const homeSettingsKey = ["home-settings"] as const;
export function useHomeSettings() {
  return useQuery({ queryKey: homeSettingsKey, queryFn: fetchHomeSettings });
}
export function useSaveHomeSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveHomeSettings,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: homeSettingsKey }),
  });
}
