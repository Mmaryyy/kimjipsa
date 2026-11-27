"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserSupabaseClient } from "@/shared/api";
import { isMockDataEnabled } from "@/shared/config";
import {
  fetchHomeDeadlines,
  fetchProject,
  fetchProjects,
  writeProject,
} from "../api/api";
import type { ProjectDetail } from "../api/type";

const key = ["projects"] as const;
const tables = [
  "projects",
  "project_areas",
  "project_milestones",
  "project_tasks",
  "project_decisions",
  "project_decision_opinions",
  "project_decision_opinion_reactions",
  "project_reservations",
  "project_itinerary",
  "project_lists",
  "project_list_items",
  "project_candidate_recipients",
  "project_candidate_votes",
  "project_photos",
  "project_expenses",
];
const recoveryInterval = () => (isMockDataEnabled() ? false : 30_000);

function useProjectChanges(familyId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!familyId || isMockDataEnabled()) return;
    const client = createBrowserSupabaseClient();
    const channel = client.channel(
      `project-changes:${familyId}:${crypto.randomUUID()}`,
    );
    const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
    const filter = `family_id=eq.${familyId}`;
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter },
        refresh,
      );
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table, filter },
        refresh,
      );
      // Postgres Changes cannot filter deletes. Refresh through the family-scoped API.
      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table },
        refresh,
      );
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") refresh();
    });
    return () => {
      void client.removeChannel(channel);
    };
  }, [familyId, queryClient]);
}

export function useProjects() {
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchProjects(signal),
    refetchInterval: recoveryInterval,
  });
  useProjectChanges(query.data?.familyId);
  return query;
}

export function useHomeDeadlines(today: string) {
  return useQuery({
    queryKey: [...key, "home-deadlines", today],
    queryFn: ({ signal }) => fetchHomeDeadlines(signal),
    refetchInterval: recoveryInterval,
  });
}

export function useProject(id: string) {
  const query = useQuery({
    queryKey: [...key, id],
    queryFn: ({ signal }) => fetchProject(id, signal),
    refetchInterval: recoveryInterval,
  });
  useProjectChanges(query.data?.familyId);
  return query;
}

export function useProjectWrite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: writeProject,
    onMutate: async (command) => {
      if (command.action !== "reorder_areas") return;
      const projectKey = [...key, command.projectId];
      await client.cancelQueries({ queryKey: projectKey });
      const previous = client.getQueryData<ProjectDetail>(projectKey);
      if (previous) {
        const positions = new Map(
          command.areaIds.map((id, index) => [id, index]),
        );
        const areas = previous.areas
          .map((area) => ({
            ...area,
            sort_order: positions.get(area.id) ?? area.sort_order,
          }))
          .sort((a, b) => a.sort_order - b.sort_order);
        client.setQueryData(projectKey, { ...previous, areas });
      }
      return previous?.areas;
    },
    onError: (_error, command, previous) => {
      if (command.action === "reorder_areas" && previous) {
        client.setQueryData<ProjectDetail>(
          [...key, command.projectId],
          (data) => data && { ...data, areas: previous },
        );
        void client.invalidateQueries({
          queryKey: [...key, command.projectId],
        });
      }
    },
    onSuccess: (_, command) =>
      client.invalidateQueries({
        queryKey: key,
        exact: command.action === "delete_project",
      }),
  });
}
