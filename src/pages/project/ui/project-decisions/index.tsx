import { Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import {
  decisionReactions,
  decisionStatusLabels,
  projectDeadlineDays,
  projectToday,
  useProjectWrite,
  type DecisionReaction,
  type ProjectDecision,
  type ProjectDetail,
} from "@/entities/project";
import { useAccount } from "@/features/account";
import { DecisionEditor, DecisionOpinionEditor } from "@/features/project-edit";
import { cn } from "@/shared/lib";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  SectionHeader,
  TextButton,
} from "@/shared/ui";

const reactions = {
  up: { icon: ThumbsUp, label: "좋아요", color: "text-success-text" },
  down: { icon: ThumbsDown, label: "글쎄요", color: "text-warning-text" },
};

function DecisionDeadline({ date, today }: { date: string; today: string }) {
  const days = projectDeadlineDays(date, today);
  let label = `D-${days}`;
  if (days < 0) label = `${-days}일 지남`;
  if (days === 0) label = "오늘";
  return (
    <time
      dateTime={date}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-control bg-sys-gray5 px-2 py-0.5 text-caption font-semibold tabular-nums",
        days === 0 && "bg-[var(--accent-soft)] text-[var(--accent-text)]",
        days > 0 && days <= 7 && "text-[var(--accent-text)]",
      )}
    >
      {days < 0 && (
        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
      )}
      {label}
    </time>
  );
}

type Opinion = ProjectDecision["opinions"][number];

function OpinionActions({
  name,
  opinion,
  mine,
  viewerId,
  members,
  onEdit,
  onReact,
  pending,
}: {
  name: string;
  opinion?: Opinion;
  mine: boolean;
  viewerId?: string | null;
  members: ProjectDetail["members"];
  onEdit: () => void;
  onReact: (opinion: Opinion, reaction: DecisionReaction | null) => void;
  pending: boolean;
}) {
  if (mine) {
    return (
      <div className="ml-auto flex max-w-1/2 shrink-0 flex-wrap items-center justify-end gap-2">
        {opinion?.reactions.map(({ user_id, reaction }) => {
          const { icon: Icon, label, color } = reactions[reaction];
          const member = members.find(
            (row) => row.user_id === user_id,
          )?.display_name;
          return (
            <span key={user_id} className={color} title={member}>
              <Icon size={13} aria-hidden />
              <span className="sr-only">
                {member} {label}
              </span>
            </span>
          );
        })}
        <Button
          size="icon-sm"
          variant="gray"
          aria-label={opinion ? "내 의견 수정" : "내 의견 쓰기"}
          onClick={onEdit}
        >
          <Pencil size={16} aria-hidden />
        </Button>
      </div>
    );
  }

  if (!viewerId || !opinion?.user_id) return null;
  const selected = opinion.reactions.find(
    (row) => row.user_id === viewerId,
  )?.reaction;
  return (
    <div
      role="group"
      aria-label={`${name} 님 의견에 반응`}
      className="flex shrink-0 gap-3"
    >
      {decisionReactions.map((reaction) => {
        const { icon: Icon, label } = reactions[reaction];
        const pressed = selected === reaction;
        return (
          <Button
            key={reaction}
            size="icon-sm"
            variant="gray"
            aria-label={label}
            aria-pressed={pressed}
            disabled={pending}
            className={cn(
              "bg-transparent text-muted-foreground",
              pressed &&
                reaction === "up" &&
                "bg-success-soft text-success-text",
              pressed &&
                reaction === "down" &&
                "bg-warning-soft text-warning-text",
            )}
            onClick={() => onReact(opinion, pressed ? null : reaction)}
          >
            <Icon size={16} aria-hidden />
          </Button>
        );
      })}
    </div>
  );
}

function DecisionDetail({
  decision,
  members,
  viewerId,
  today,
  onEdit,
  onEditOpinion,
  onReact,
  pending,
}: {
  decision: ProjectDecision;
  members: ProjectDetail["members"];
  viewerId?: string | null;
  today: string;
  onEdit: () => void;
  onEditOpinion: () => void;
  onReact: (opinion: Opinion, reaction: DecisionReaction | null) => void;
  pending: boolean;
}) {
  const options = decision.options
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);
  const opinionsByMember = new Map(
    decision.opinions.map((opinion) => [opinion.user_id, opinion]),
  );
  const opinions = members.map(({ user_id, display_name }) => {
    const mine = user_id === viewerId;
    return {
      id: user_id,
      name: display_name,
      opinion: opinionsByMember.get(user_id),
      mine,
      placeholder: mine
        ? "내 의견을 남겨 보세요"
        : `${display_name} 님은 아직 의견이 없어요`,
    };
  });
  const formerOpinions = decision.opinions.filter(
    ({ user_id }) => !members.some((member) => member.user_id === user_id),
  );

  return (
    <article
      className="border-border py-4 [&+&]:border-t"
      data-od-id={`prj-decision-${decision.id}`}
    >
      <h3 className="text-headline font-semibold">
        <TextButton
          tone="neutral"
          size="sm"
          className="w-full items-start justify-between gap-3 whitespace-normal text-left"
          onClick={onEdit}
        >
          <span className="min-w-0 text-headline font-semibold wrap-anywhere">
            {decision.question}
          </span>
          {decision.due_on && (
            <DecisionDeadline date={decision.due_on} today={today} />
          )}
        </TextButton>
      </h3>
      {decision.status === "decided" && decision.final_choice && (
        <p className="mt-2 font-semibold wrap-anywhere">
          {decision.final_choice}
        </p>
      )}
      {options.length > 0 && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-caption wrap-anywhere text-muted-foreground">
          <span>후보</span>
          {options.map((option, index) => (
            <span
              key={`${index}-${option}`}
              className="font-medium text-foreground"
            >
              {index > 0 && (
                <span className="mr-2 text-muted-foreground">·</span>
              )}
              {option}
            </span>
          ))}
        </p>
      )}
      <ul className="mt-3 grid gap-2">
        {opinions.map(({ id, name, opinion, mine, placeholder }) => (
          <li key={id} className="flex min-h-10 items-center gap-2">
            <span className="min-w-7 shrink-0 text-caption font-semibold text-muted-foreground">
              {name}
            </span>
            <p
              className={cn(
                "min-w-0 flex-1 text-body-sm wrap-anywhere whitespace-pre-wrap",
                !opinion?.opinion && "text-muted-foreground",
              )}
            >
              {opinion?.opinion || placeholder}
            </p>
            <OpinionActions
              name={name}
              opinion={opinion}
              mine={mine}
              viewerId={viewerId}
              members={members}
              onEdit={onEditOpinion}
              onReact={onReact}
              pending={pending}
            />
          </li>
        ))}
        {formerOpinions.map(({ id, opinion }) => (
          <li key={id} className="flex min-h-10 items-center gap-2">
            <span className="shrink-0 text-caption font-semibold text-muted-foreground">
              탈퇴한 구성원
            </span>
            <p className="min-w-0 text-body-sm wrap-anywhere whitespace-pre-wrap">
              {opinion}
            </p>
          </li>
        ))}
      </ul>
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
  const { data: account } = useAccount();
  const viewerId = account?.userId;
  const write = useProjectWrite();
  const today = projectToday();
  const [opinionEditor, setOpinionEditor] = useState<string>();
  const groups = Map.groupBy(decisions, (decision) => decision.status);
  const current = decisions.find((decision) => decision.id === editor);
  const editingOpinion = decisions.find(
    (decision) => decision.id === opinionEditor,
  );
  const discussing = (groups.get("discussing") ?? []).sort((a, b) =>
    (a.due_on ?? "9").localeCompare(b.due_on ?? "9"),
  );
  const onHold = groups.get("on_hold") ?? [];
  const decided = groups.get("decided") ?? [];

  const renderDecision = (decision: ProjectDecision) => (
    <DecisionDetail
      key={decision.id}
      decision={decision}
      members={members}
      viewerId={viewerId}
      today={today}
      onEdit={() => setEditor(decision.id)}
      onEditOpinion={() => setOpinionEditor(decision.id)}
      pending={write.isPending}
      onReact={(opinion, reaction) =>
        write.mutate({
          action: "set_decision_opinion_reaction",
          projectId: project.id,
          id: decision.id,
          opinionId: opinion.id,
          reaction,
        })
      }
    />
  );

  return (
    <>
      {write.error && (
        <p className="text-sm text-destructive" role="alert">
          {write.error.message}
        </p>
      )}
      {discussing.length > 0 ? (
        <section
          aria-labelledby="prj-discussing-title"
          data-od-id="prj-decisions-open"
          className="[&>[data-slot=section-header]]:mt-4"
        >
          <SectionHeader
            id="prj-discussing-title"
            title={`논의 중 ${discussing.length}`}
          />
          {discussing.map(renderDecision)}
        </section>
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          논의 중인 결정이 없어요.
        </p>
      )}
      {onHold.length > 0 && (
        <section
          aria-labelledby="prj-hold-title"
          data-od-id="prj-decisions-hold"
        >
          <SectionHeader id="prj-hold-title" title={`보류 ${onHold.length}`} />
          {onHold.map(renderDecision)}
        </section>
      )}
      {decided.length > 0 && (
        <Accordion
          type="single"
          collapsible
          className="mt-4"
          data-od-id="prj-decisions-done"
        >
          <AccordionItem value="decided" variant="plain">
            <AccordionTrigger
              heading="h2"
              tone="muted"
              className="font-semibold text-label"
            >
              {decisionStatusLabels.decided}{" "}
              <span className="tabular-nums">{decided.length}</span>
            </AccordionTrigger>
            <AccordionContent>{decided.map(renderDecision)}</AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      {editor !== undefined && (editor === "" || current) && (
        <DecisionEditor
          key={editor}
          projectId={project.id}
          decision={current}
          onClose={() => setEditor()}
        />
      )}
      {editingOpinion && (
        <DecisionOpinionEditor
          key={editingOpinion.id}
          decision={editingOpinion}
          opinion={
            editingOpinion.opinions.find(({ user_id }) => user_id === viewerId)
              ?.opinion ?? ""
          }
          onClose={() => setOpinionEditor(undefined)}
        />
      )}
    </>
  );
}

export default ProjectDecisions;
