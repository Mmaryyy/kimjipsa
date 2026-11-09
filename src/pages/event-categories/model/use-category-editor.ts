"use client";
import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveCategory,
  deleteCategory,
  categoryQueryKey,
  savedCategoryColorsQueryKey,
  eventQueryKey,
  type EventCategoryInput,
} from "@/entities/event";
export function useCategoryEditor(id: string | undefined, onSaved: () => void) {
  const queryClient = useQueryClient();
  const onSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: categoryQueryKey });
    await queryClient.invalidateQueries({
      queryKey: savedCategoryColorsQueryKey,
    });
    await queryClient.invalidateQueries({ queryKey: eventQueryKey });
    onSaved();
  };
  const save = useMutation({
    mutationFn: (input: EventCategoryInput) => saveCategory(input, id),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: () => deleteCategory(id!),
    onSuccess,
  });
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
