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
  const remove = useMutation({ mutationFn: () => deleteEvent(id!), onSuccess });
  const onDelete = useCallback(() => {
    if (id) remove.mutate();
  }, [id, remove]);
  return {
    onSave: save.mutateAsync,
    onDelete,
    deleting: remove.isPending,
    deleteError: remove.error,
  };
}
