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
import ProjectBudget, { budgetLimitEditorId } from "../project-budget";
import ProjectItinerary from "../project-itinerary";

const addIds: Partial<Record<keyof typeof pages, string>> = {
  decisions: "prj-decision-add",
  budget: "prj-expense-add",
  itinerary: "prj-itinerary-add",
};

const pages = {
  decisions: ProjectDecisions,
  reservations: ProjectReservations,
  itinerary: ProjectItinerary,
  budget: ProjectBudget,
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
        titleOdId:
          module === "budget" || module === "itinerary"
            ? `prj-${module}-title`
            : undefined,
        navigation,
        subtitle: data?.project.title,
        subtitleVariant: module === "decisions" ? "context-muted" : "context",
        actions: data && (
          <>
            <Button
              variant="glass"
              data-od-id={addIds[module]}
              onClick={() => setEditor("")}
            >
              추가
            </Button>
            {module === "budget" && (
              <Button
                variant="glass"
                data-od-id="prj-budget-cap"
                onClick={() => setEditor(budgetLimitEditorId)}
              >
                설정
              </Button>
            )}
          </>
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
