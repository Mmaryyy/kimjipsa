import { format } from "date-fns";
import {
  MilestoneTimeline,
  projectToday,
  type ProjectDetail,
} from "@/entities/project";
import { ItineraryEditor } from "@/features/project-edit";
import ProjectItineraryDay from "./Day";
import { itineraryTimeline } from "./itinerary.utils";

interface Props {
  data: ProjectDetail;
  editor?: string;
  setEditor: (id?: string) => void;
}

const ProjectItinerary = ({ data, editor, setEditor }: Props) => {
  const { project, itinerary } = data;
  const { days, reservationCount } = itineraryTimeline(data);
  const first = days[0];
  const last = days.at(-1);
  const editing = itinerary.find((row) => row.id === editor);

  return (
    <>
      {first && last ? (
        <>
          <p className="text-caption text-muted-foreground tabular-nums">
            {format(first.day, "M.d")}
            {first !== last && ` – ${format(last.day, "M.d")}`} · {days.length}
            일 · 예약 {reservationCount}건
          </p>
          <MilestoneTimeline
            days={days}
            today={projectToday()}
            renderDay={(index, current) => (
              <ProjectItineraryDay
                entry={days[index]}
                index={index}
                current={current}
                projectId={project.id}
                onEdit={setEditor}
              />
            )}
          />
        </>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          아직 일정표가 비어 있어요.
        </p>
      )}
      {itinerary.some((row) => row.event_id) && (
        <p
          className="mt-4 text-sm text-muted-foreground"
          data-od-id="prj-event-unlink-note"
        >
          연결된 일정을 삭제하면 이 항목은 남고 일정에 추가 버튼이 다시
          나타나요.
        </p>
      )}
      {editor !== undefined && (editor === "" || editing) && (
        <ItineraryEditor
          key={editor}
          projectId={project.id}
          itinerary={editing}
          onClose={() => setEditor()}
        />
      )}
    </>
  );
};

export default ProjectItinerary;
