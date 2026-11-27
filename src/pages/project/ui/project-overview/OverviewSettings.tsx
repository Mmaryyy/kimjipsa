import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ProjectArea, ProjectDetail } from "@/entities/project";
import {
  AreaEditor,
  MilestoneEditor,
  ProjectEditor,
} from "@/features/project-edit";
import { List, Sheet, TextButton, Toast } from "@/shared/ui";
import SortableList from "@/shared/ui/sortable-list";
import { useAreaOrder } from "../../model/use-area-order";
import { projectOverviewButtonStyles } from "./project-overview.variants";

const settings = [
  { key: "project", label: "프로젝트 정보" },
  { key: "areas", label: "영역" },
  { key: "milestones", label: "마일스톤" },
] as const;

const closeAction = (close: () => void) => (
  <TextButton tone="neutral" size="sm" onClick={close}>
    닫기
  </TextButton>
);

function AreaSettings({
  id,
  areas,
  onClose,
}: {
  id: string;
  areas: ProjectArea[];
  onClose: () => void;
}) {
  const [editor, setEditor] = useState<ProjectArea | "new">();
  const [toastOpen, setToastOpen] = useState(false);
  const order = useAreaOrder(id, () => setToastOpen(true));

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="영역"
      description="프로젝트의 영역을 관리해요."
      leadingAction={() => closeAction(onClose)}
      action={
        <TextButton size="sm" onClick={() => setEditor("new")}>
          추가
        </TextButton>
      }
    >
      {order.error && (
        <p role="alert" className="text-caption text-error-text">
          순서를 저장하지 못해 원래 순서로 되돌렸어요. {order.error.message}
        </p>
      )}
      {areas.length ? (
        <SortableList
          items={order.localAreas ?? areas}
          onEdit={setEditor}
          renderItem={(area) => (
            <span className="min-w-0 flex-1 truncate text-left">
              {area.name}
            </span>
          )}
          disabled={editor !== undefined}
          busy={order.saving}
          onDragStart={order.onDragStart}
          onDragCancel={order.onDragCancel}
          onMove={order.onMove}
        />
      ) : (
        <p className="py-3 text-caption text-muted-foreground">
          등록된 영역이 없어요.
        </p>
      )}
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        message="순서를 저장했어요"
        duration={2000}
      />
      {editor && (
        <AreaEditor
          projectId={id}
          area={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
        />
      )}
    </Sheet>
  );
}

function OverviewSettings({
  data,
  onClose,
}: {
  data: ProjectDetail;
  onClose: () => void;
}) {
  const [editor, setEditor] = useState<(typeof settings)[number]["key"]>();
  const { project, areas, milestones } = data;
  const closeEditor = () => setEditor(undefined);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="설정"
      description="프로젝트 정보, 영역, 마일스톤을 관리해요."
      leadingAction={() => closeAction(onClose)}
    >
      <List variant="divided">
        {settings.map(({ key, label }) => (
          <li key={key}>
            <TextButton
              tone="neutral"
              size={null}
              className={projectOverviewButtonStyles()}
              onClick={() => setEditor(key)}
            >
              {label}
              <ChevronRight
                aria-hidden
                size={16}
                className="text-muted-foreground"
              />
            </TextButton>
          </li>
        ))}
      </List>
      {editor === "project" && (
        <ProjectEditor
          project={project}
          onClose={closeEditor}
          deletedPath="/projects"
        />
      )}
      {editor === "areas" && (
        <AreaSettings id={project.id} areas={areas} onClose={closeEditor} />
      )}
      {editor === "milestones" && (
        <MilestoneEditor
          projectId={project.id}
          areas={areas}
          milestones={milestones}
          onClose={closeEditor}
        />
      )}
    </Sheet>
  );
}

export default OverviewSettings;
