import type {
  CandidateVote,
  ProjectDetail,
  ProjectListDefinition,
  ProjectListItem,
  ProjectMember,
} from "../api/type";

export function projectTagCounts(
  items: Pick<ProjectListItem, "tags" | "done_tags">[],
  key: string,
) {
  let total = 0;
  let done = 0;
  for (const item of items) {
    if (!item.tags.includes(key)) continue;
    total++;
    if (item.done_tags.includes(key)) done++;
  }
  return { total, done };
}

export function projectQuantitySource(
  list: ProjectListDefinition,
  lists: ProjectListDefinition[],
  items: ProjectListItem[],
) {
  const roster = lists.find(
    (row) =>
      row.id === list.quantity_list_id &&
      row.kind === "people" &&
      row.project_id === list.project_id,
  );
  const tag = roster?.tags.find(({ key }) => key === list.quantity_tag_key);
  if (!roster || !tag) return null;
  const people = items.filter(
    (item) => item.list_id === roster.id && item.tags.includes(tag.key),
  );
  return { roster: roster.name, tag: tag.label, count: people.length, people };
}

export function projectCandidateEstimate(
  price: number | null,
  count: number | null,
) {
  return price === null || count === null ? null : price * count;
}

export function projectCandidateStatus(
  status: ProjectListItem["status"],
  votes: CandidateVote[],
  members: ProjectMember[],
): NonNullable<ProjectListItem["status"]> {
  if (status === "selected" || status === "excluded") return status;
  const byMember = new Map(votes.map(({ user_id, vote }) => [user_id, vote]));
  if (
    members.length &&
    members.every(({ user_id }) => byMember.get(user_id) === "up")
  )
    return "selected";
  if (
    members.length &&
    members.every(({ user_id }) => byMember.get(user_id) === "down")
  )
    return "excluded";
  return "candidate";
}

export function projectCandidates(
  list: ProjectListDefinition,
  data: Pick<
    ProjectDetail,
    "lists" | "listItems" | "candidateRecipients" | "candidateVotes" | "members"
  >,
) {
  const source = projectQuantitySource(list, data.lists, data.listItems);
  const people = source?.people ?? [];
  const items = data.listItems.filter(({ list_id }) => list_id === list.id);
  const byId = new Map(items.map((item) => [item.id, item]));
  const assignedTo = new Map(
    data.candidateRecipients
      .filter(({ list_id }) => list_id === list.id)
      .map(({ candidate_id, person_id }) => [
        person_id,
        byId.get(candidate_id),
      ]),
  );
  const votesByCandidate = Map.groupBy(
    data.candidateVotes,
    ({ candidate_id }) => candidate_id,
  );
  const candidates = items.map((item) => {
    const recipients = people.filter(({ id }) => assignedTo.get(id) === item);
    const votes = votesByCandidate.get(item.id) ?? [];
    return {
      item,
      people: recipients,
      votes,
      status: projectCandidateStatus(item.status, votes, data.members),
      total: projectCandidateEstimate(item.price, recipients.length || null),
    };
  });
  return { source, people, assignedTo, candidates };
}

export function projectCandidateSummary(
  candidates: Pick<
    ReturnType<typeof projectCandidates>["candidates"][number],
    "status" | "total"
  >[],
) {
  let selected = 0;
  let estimate: number | null = null;
  for (const { status, total } of candidates) {
    if (status !== "selected") continue;
    selected++;
    if (total !== null) estimate = (estimate ?? 0) + total;
  }
  return { selected, estimate };
}
