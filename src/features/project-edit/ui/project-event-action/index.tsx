"use client";

import { useQueryClient } from "@tanstack/react-query";
import { eventQueryKey } from "@/entities/event";
import { useProjectWrite, type ProjectEventSource } from "@/entities/project";
import { StatusBadge, TextButton } from "@/shared/ui";

const ids: Record<ProjectEventSource, string> = {
  milestones: "prj-event-milestone",
  reservations: "prj-event-reservation",
  itinerary: "prj-event-itinerary",
};

function ProjectEventAction({
  row,
  source,
}: {
  row: {
    id: string;
    project_id: string;
    event_id: string | null;
    starts_on: string | null;
  };
  source: ProjectEventSource;
}) {
  const write = useProjectWrite();
  const queryClient = useQueryClient();
  if (row.event_id) {
    return (
      <StatusBadge variant="success" data-od-id="prj-event-linked">
        일정 연결됨
      </StatusBadge>
    );
  }

  return (
    <div>
      <TextButton
        type="button"
        data-od-id={ids[source]}
        disabled={!row.starts_on || write.isPending}
        onClick={() =>
          write.mutate(
            {
              action: "add_project_event",
              source,
              projectId: row.project_id,
              id: row.id,
            },
            {
              onSuccess: () =>
                void queryClient.invalidateQueries({ queryKey: eventQueryKey }),
            },
          )
        }
      >
        일정에 추가
      </TextButton>
      {write.isError && (
        <p className="text-sm text-destructive" role="alert">
          {write.error.message}
        </p>
      )}
    </div>
  );
}

export default ProjectEventAction;
