"use client";

import { useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useProjectWrite, type ProjectArea } from "@/entities/project";

export function useAreaOrder(projectId: string, onSaved: () => void) {
  const saving = useRef(false);
  const snapshot = useRef<ProjectArea[] | null>(null);
  const [localAreas, setLocalAreas] = useState<ProjectArea[] | null>(null);
  const write = useProjectWrite();

  function onDragCancel() {
    if (saving.current) return;
    snapshot.current = null;
    setLocalAreas(null);
  }

  function onDragStart(areas: ProjectArea[]) {
    if (saving.current) return;
    write.reset();
    snapshot.current = areas;
    setLocalAreas(areas);
  }

  async function onMove(activeId: string, overId: string) {
    const areas = snapshot.current;
    if (saving.current || !areas) return;
    const from = areas.findIndex((area) => area.id === activeId);
    const to = areas.findIndex((area) => area.id === overId);
    if (from < 0 || to < 0 || from === to) {
      onDragCancel();
      return;
    }

    saving.current = true;
    const ordered = arrayMove(areas, from, to);
    setLocalAreas(ordered);
    try {
      await write.mutateAsync({
        action: "reorder_areas",
        projectId,
        areaIds: ordered.map((area) => area.id),
      });
      onSaved();
    } catch {
      // The query restores the previous order and the list shows the error.
    } finally {
      saving.current = false;
      onDragCancel();
    }
  }

  return {
    localAreas,
    saving: write.isPending,
    error: write.error,
    onDragStart,
    onDragCancel,
    onMove,
  };
}
