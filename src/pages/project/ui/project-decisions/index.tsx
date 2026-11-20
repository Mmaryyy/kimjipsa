import {
  decisionStatuses,
  decisionStatusLabels,
  projectShortPeriod,
  type ProjectDecision,
  type ProjectDetail,
} from "@/entities/project";
import { DecisionEditor } from "@/features/project-edit";
import {
  List,
  ListRow,
  SectionHeader,
  StatusBadge,
  TextButton,
} from "@/shared/ui";

const tones = {
  discussing: "info",
  decided: "success",
  on_hold: "warning",
} as const;

function DecisionDetail({
  decision,
  members,
  edit,
}: {
  decision: ProjectDecision;
  members: ProjectDetail["members"];
  edit: () => void;
}) {
  if (
    decision.status === "decided" &&
    !decision.options &&
    decision.opinions.length === 0 &&
    !decision.due_on
  ) {
    return (
      <article className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2">
        <div className="min-w-0">
          <TextButton
            className="text-left font-semibold text-foreground"
            onClick={edit}
          >
            {decision.question}
          </TextButton>
          {decision.final_choice && (
            <p className="text-sm wrap-anywhere text-muted-foreground">
              최종 선택 · {decision.final_choice}
            </p>
          )}
        </div>
        <StatusBadge variant="success">결정 완료</StatusBadge>
      </article>
    );
  }

  const orphaned = decision.opinions.filter(
    (row) => !members.some(({ user_id }) => row.user_id === user_id),
  );
  const opinions = [
    ...members.map(({ user_id, display_name }) => ({
      id: user_id,
      label: `${display_name}의 의견`,
      opinion:
        decision.opinions.find((row) => row.user_id === user_id)?.opinion ?? "",
    })),
    ...orphaned.map(({ id, opinion }) => ({
      id,
      opinion,
      label: "탈퇴한 구성원의 의견",
    })),
  ];
  return (
    <article
      className="space-y-2 border-b border-border/60 py-3"
      data-od-id="prj-decision-detail"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold wrap-anywhere">
          {decision.question}
        </h3>
        <StatusBadge variant={tones[decision.status]}>
          {decisionStatusLabels[decision.status]}
        </StatusBadge>
      </div>
      {decision.due_on && (
        <p className="text-sm text-muted-foreground">
          기한 {projectShortPeriod(decision.due_on, null, "")}
        </p>
      )}
      {decision.options && (
        <p className="text-sm wrap-anywhere whitespace-pre-wrap">
          후보 · {decision.options}
        </p>
      )}
      <List>
        {opinions.map(({ id, label, opinion }) => (
          <ListRow key={id} className="border-b border-border/60 last:border-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {opinion || "아직 의견이 없어요."}
            </p>
          </ListRow>
        ))}
      </List>
      <p className="text-sm wrap-anywhere">
        최종 선택 · {decision.final_choice || "아직 정하지 않았어요"}
      </p>
      <TextButton type="button" onClick={edit}>
        결정 수정
      </TextButton>
    </article>
  );
}

function ProjectDecisions({
  data,
  editor,
  setEditor,
}: {
  data: ProjectDetail;
  editor?: string;
  setEditor: (id?: string) => void;
}) {
  const { project, decisions, members } = data;
  const [discussing, decided, onHold] = decisionStatuses;
  const groups = Map.groupBy(decisions, (decision) => decision.status);
  const current = decisions.find((decision) => decision.id === editor);

  return (
    <>
      {decisions.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          아직 결정이 없어요.
        </p>
      )}
      {[discussing, onHold, decided].map((status) => {
        const rows = groups.get(status);
        if (!rows?.length) return null;
        return (
          <section key={status} aria-labelledby={`prj-decisions-${status}`}>
            <SectionHeader
              id={`prj-decisions-${status}`}
              title={decisionStatusLabels[status]}
            />
            {rows.map((decision) => (
              <DecisionDetail
                key={decision.id}
                decision={decision}
                members={members}
                edit={() => setEditor(decision.id)}
              />
            ))}
          </section>
        );
      })}
      {editor !== undefined && (editor === "" || current) && (
        <DecisionEditor
          key={editor}
          projectId={project.id}
          members={members}
          decision={current}
          onClose={() => setEditor()}
        />
      )}
    </>
  );
}

export default ProjectDecisions;
