"use client";
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveEvent,
  deleteEvent,
  eventQueryKey,
  type EventInput,
} from "@/entities/event";
export function useEventEditor(id: string | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: eventQueryKey });
    onSaved();
  };
  const save = useMutation({
    mutationFn: (input: EventInput) => saveEvent(input, id),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (scope?: "single" | "following") => deleteEvent(id!, scope),
    onSuccess,
  });
  const onDelete = useCallback(
    (scope?: "single" | "following") => {
      if (id) remove.mutate(scope);
    },
    [id, remove],
  );
  return {
    onSave: save.mutateAsync,
    onDelete,
    deleting: remove.isPending,
    deleteError: remove.error,
  };
}
