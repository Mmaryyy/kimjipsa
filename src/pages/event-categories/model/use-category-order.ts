"use client";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoryQueryKey,
  reorderCategory,
  type EventCategory,
} from "@/entities/event";
import { moveCategory } from "../lib/category-order.utils";

type Move = NonNullable<ReturnType<typeof moveCategory>>;

export function useCategoryOrder(onSaved?: () => void) {
  const queryClient = useQueryClient();
  const saving = useRef(false);
  const snapshot = useRef<EventCategory[] | null>(null);
  const [localCategories, setLocalCategories] = useState<
    EventCategory[] | null
  >(null);
  const onDragCancel = useCallback(() => {
    if (saving.current) return;
    snapshot.current = null;
    setLocalCategories(null);
  }, []);
  const onDragStart = useCallback((categories: EventCategory[]) => {
    if (saving.current) return;
    // 포커스 재조회가 와도 집은 목록과 저장할 순서의 기준을 유지해요.
    snapshot.current = categories;
    setLocalCategories(categories);
  }, []);
  const mutation = useMutation({
    mutationFn: (move: Move) => reorderCategory(move.category, move.sortOrder),
    onMutate: async (move) => {
      await queryClient.cancelQueries({ queryKey: categoryQueryKey });
      const previous =
        queryClient.getQueryData<EventCategory[]>(categoryQueryKey);
      queryClient.setQueryData(categoryQueryKey, move.categories);
      return previous;
    },
    onError: (_error, _move, previous) => {
      if (previous) queryClient.setQueryData(categoryQueryKey, previous);
    },
    onSuccess: () => onSaved?.(),
    onSettled: async () => {
      try {
        await queryClient.invalidateQueries({ queryKey: categoryQueryKey });
      } finally {
        saving.current = false;
        snapshot.current = null;
        setLocalCategories(null);
      }
    },
  });
  const { mutate } = mutation;
  const onMove = useCallback(
    (activeId: string, overId: string) => {
      if (saving.current) return;
      const categories =
        snapshot.current ??
        queryClient.getQueryData<EventCategory[]>(categoryQueryKey);
      const move = moveCategory(categories ?? [], activeId, overId);
      if (!move) {
        onDragCancel();
        return;
      }
      saving.current = true;
      setLocalCategories(move.categories);
      mutate(move);
    },
    [mutate, onDragCancel, queryClient],
  );
  return {
    onMove,
    onDragStart,
    onDragCancel,
    localCategories,
    saving: mutation.isPending,
    error: mutation.error,
  };
}
