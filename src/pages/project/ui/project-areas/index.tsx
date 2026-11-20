"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useProject, type ProjectArea } from "@/entities/project";
import { AreaEditor } from "@/features/project-edit";
import { ApiError } from "@/shared/api";
import {
  Button,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageLayout,
  Text,
  Toast,
} from "@/shared/ui";
import SortableList from "@/shared/ui/sortable-list";
import { useAreaOrder } from "../../model/use-area-order";
import ProjectBackLink from "../project-header";

function AreaList({
  areas,
  projectId,
  onEdit,
  editing,
}: {
  areas: ProjectArea[];
  projectId: string;
  onEdit: (area: ProjectArea) => void;
  editing: boolean;
}) {
  const [toastOpen, setToastOpen] = useState(false);
  const order = useAreaOrder(projectId, () => setToastOpen(true));

  if (!areas.length) return <EmptyState message="등록된 영역이 없어요." />;

  return (
    <>
      {order.error && (
        <Text as="p" role="alert" className="mb-3 text-error-text">
          순서를 저장하지 못해 원래 순서로 되돌렸어요. {order.error.message}
        </Text>
      )}
      <SortableList
        items={order.localAreas ?? areas}
        onEdit={onEdit}
        renderItem={(area) => (
          <>
            <span className="min-w-0 flex-1 truncate text-left">
              {area.name}
            </span>
            <ChevronRight
              aria-hidden
              size={16}
              className="text-[var(--icon-tertiary)]"
            />
          </>
        )}
        disabled={editing}
        busy={order.saving}
        onDragStart={(items) => {
          setToastOpen(false);
          order.onDragStart(items);
        }}
        onDragCancel={order.onDragCancel}
        onMove={order.onMove}
      />
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        message="순서를 저장했어요"
        duration={2000}
      />
    </>
  );
}

function ProjectAreas({ id }: { id: string }) {
  const query = useProject(id);
  const [editor, setEditor] = useState<ProjectArea | "new">();
  const unavailable =
    query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const data = unavailable ? undefined : query.data;

  return (
    <PageLayout
      width="narrow"
      odId="prj-areas"
      header={{
        odId: "prj-areas",
        title: "영역 설정",
        navigation: <ProjectBackLink href={`/projects/${id}`} label="뒤로" />,
        actions: data && (
          <Button
            variant="glass"
            data-od-id="prj-area-add"
            onClick={() => setEditor("new")}
          >
            추가
          </Button>
        ),
      }}
    >
      <section
        className="mt-4"
        aria-label="영역 목록"
        data-od-id="prj-area-list"
      >
        {data ? (
          <AreaList
            projectId={id}
            areas={data.areas}
            onEdit={setEditor}
            editing={editor !== undefined}
          />
        ) : query.isPending ? (
          <ListSkeleton label="영역을 불러오고 있어요" />
        ) : (
          <ErrorState
            message={query.error?.message}
            onRetry={() => void query.refetch()}
          />
        )}
      </section>
      {data && editor && (
        <AreaEditor
          projectId={id}
          area={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
        />
      )}
    </PageLayout>
  );
}

export default ProjectAreas;
