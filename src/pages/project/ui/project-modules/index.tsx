"use client";

import { useState } from "react";
import { projectModuleLabels, useProject } from "@/entities/project";
import { ApiError } from "@/shared/api";
import {
  Button,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageLayout,
} from "@/shared/ui";
import ProjectBackLink from "../project-header";
import ProjectDecisions from "../project-decisions";
import ProjectReservations from "../project-reservations";
import ProjectItinerary from "../project-itinerary";

const pages = {
  decisions: ProjectDecisions,
  reservations: ProjectReservations,
  itinerary: ProjectItinerary,
};

function ProjectModules({
  id,
  module,
}: {
  id: string;
  module: keyof typeof pages;
}) {
  const query = useProject(id);
  const [editor, setEditor] = useState<string>();
  const title = projectModuleLabels[module];
  const navigation = (
    <ProjectBackLink href={`/projects/${id}`} label="프로젝트 개요" />
  );
  const forbidden =
    query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const data =
    !forbidden && query.data?.project.modules.includes(module)
      ? query.data
      : undefined;
  const Content = pages[module];

  return (
    <PageLayout
      width="narrow"
      odId={`prj-${module}`}
      header={{
        title,
        navigation,
        subtitle: data?.project.title,
        subtitleVariant: "context",
        actions: data && (
          <Button variant="glass" onClick={() => setEditor("")}>
            추가
          </Button>
        ),
      }}
    >
      {data ? (
        <Content data={data} editor={editor} setEditor={setEditor} />
      ) : query.isPending ? (
        <ListSkeleton />
      ) : query.error ? (
        <ErrorState
          message={query.error.message}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <EmptyState message="이 구성 요소가 꺼져 있어요." />
      )}
    </PageLayout>
  );
}

export default ProjectModules;
