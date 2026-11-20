import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { projectShortPeriod, type ProjectDetail } from "@/entities/project";
import { ItineraryEditor, ProjectEventAction } from "@/features/project-edit";
import { List, ListRow, SectionHeader, TextButton } from "@/shared/ui";

function ProjectItinerary({
  data,
  editor,
  setEditor,
}: {
  data: ProjectDetail;
  editor?: string;
  setEditor: (id?: string) => void;
}) {
  const { project, itinerary } = data;
  const dayGroups = Map.groupBy(itinerary, (row) => row.starts_on);
  const editing = itinerary.find((row) => row.id === editor);

  return (
    <>
      {itinerary.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          아직 일정표가 비어 있어요.
        </p>
      )}
      {[...dayGroups.keys()].sort().map((date) => (
        <section key={date} aria-labelledby={`prj-itinerary-${date}`}>
          <SectionHeader
            id={`prj-itinerary-${date}`}
            title={format(parseISO(date), "yyyy.MM.dd EEEE", { locale: ko })}
          />
          <List>
            {dayGroups.get(date)?.map((row) => (
              <ListRow
                key={row.id}
                className="border-b border-border/60"
                trailing={<ProjectEventAction row={row} source="itinerary" />}
              >
                <TextButton
                  type="button"
                  className="text-left font-semibold text-foreground"
                  onClick={() => setEditor(row.id)}
                >
                  {row.title}
                </TextButton>
                {row.ends_on && row.ends_on !== row.starts_on && (
                  <p className="text-sm text-muted-foreground">
                    ~ {projectShortPeriod(row.ends_on, null, "")}
                  </p>
                )}
                {(row.place || row.memo) && (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {[row.place, row.memo].filter(Boolean).join(" · ")}
                  </p>
                )}
                {row.links.map((link, index) => (
                  <TextButton asChild key={index}>
                    <a href={link} target="_blank" rel="noreferrer">
                      링크{row.links.length > 1 ? ` ${index + 1}` : ""} ↗
                    </a>
                  </TextButton>
                ))}
              </ListRow>
            ))}
          </List>
        </section>
      ))}
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
}

export default ProjectItinerary;
