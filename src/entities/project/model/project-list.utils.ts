import type { ProjectListDefinition, ProjectListItem } from "../api/type";

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
  const { total } = projectTagCounts(
    items.filter((item) => item.list_id === roster.id),
    tag.key,
  );
  return { roster: roster.name, tag: tag.label, count: total };
}

export function projectCandidateEstimate(
  price: number | null,
  count: number | null,
) {
  return price === null || count === null ? null : price * count;
}
