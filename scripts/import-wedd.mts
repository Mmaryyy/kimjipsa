import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  mapWedd,
  snapshotSchema,
  tables,
  targetSchema,
  type Row,
  type Table,
} from "./wedd-mapping.mts";

function sqlLiteral(value: unknown) {
  // Pick a delimiter absent even from the end of the payload.
  const source = typeof value === "string" ? value : JSON.stringify(value);
  let index = 0;
  let delimiter = "$wedd0$";
  while ((source + delimiter).indexOf(delimiter) !== source.length) {
    delimiter = `$wedd${++index}$`;
  }
  return `${delimiter}${source}${delimiter}`;
}

const { values } = parseArgs({
  options: {
    snapshot: { type: "string" },
    family: { type: "string" },
    hyerim: { type: "string" },
    taehyun: { type: "string" },
  },
});

if (!values.snapshot) {
  throw new Error(
    "사용법: node scripts/import-wedd.mts --snapshot <JSON> --family <UUID>" +
      " --hyerim <헤줄 UUID> --taehyun <데굴 UUID>",
  );
}

// The private JSON export contains { writeStoppedAt, records: [{ id, kind, version, updatedAt, data }] }.
const snapshot = snapshotSchema.parse(
  JSON.parse(await readFile(values.snapshot, "utf8")),
);
const target = targetSchema.parse({
  familyId: values.family,
  hyerimId: values.hyerim,
  taehyunId: values.taehyun,
});
if (Date.parse(snapshot.writeStoppedAt) > Date.now()) {
  throw new Error("쓰기 중지 시각은 미래일 수 없습니다.");
}
if (
  snapshot.records.some(
    ({ updatedAt }) =>
      Date.parse(updatedAt) > Date.parse(snapshot.writeStoppedAt),
  )
) {
  throw new Error(
    "쓰기 중지 시각 이후에 변경된 문서가 있습니다. " +
      "다시 쓰기를 중지한 뒤 내보내 주세요.",
  );
}

const rows = mapWedd(snapshot, target);
const projectId = rows.get("projects")?.[0].id;
const settings = snapshot.records.find(({ kind }) => kind === "settings");
if (!projectId || !settings) throw new Error("이전 대상 프로젝트가 없습니다.");

const family = sqlLiteral(target.familyId);
const project = sqlLiteral(projectId);
const projectSource = sqlLiteral(`wedd:records/${settings.id}`);
const tableNames = Object.keys(tables) as Table[];

function qualified(table: string) {
  return `public.${table}`;
}

function typedRows(table: Table, records: Row[]) {
  return `jsonb_populate_recordset(null::${qualified(table)}, ${sqlLiteral(records)}::jsonb)`;
}

function insert(table: Table, records: Row[]) {
  if (!records.length) return "";
  const columns = Object.keys(records[0])
    .map((key) => `"${key}"`)
    .join(", ");
  const projectOrder =
    table === "projects"
      ? `, (select coalesce(max(sort_order) + 1, 0) from public.projects where family_id = ${family})`
      : "";
  const insertOrder = table === "projects" ? ", sort_order" : "";
  return `insert into ${qualified(table)} (${columns}${insertOrder})
select ${columns}${projectOrder}
from ${typedRows(table, records)} as incoming
on conflict (family_id, source_ref) do nothing;`;
}

function projectScope(table: Table) {
  const parentKey = tables[table];
  switch (parentKey) {
    case "project_id":
      return `stored.project_id = ${project}`;
    case "decision_id":
      return `stored.decision_id in (
        select id from public.project_decisions
        where family_id = ${family} and project_id = ${project}
      )`;
    case "list_id":
      return `stored.list_id in (
        select id from public.project_lists
        where family_id = ${family} and project_id = ${project}
      )`;
    default:
      return `stored.id = ${project}`;
  }
}

type SourceCheck = {
  table: Table;
  kinds: readonly string[];
  fields?: Record<string, string>;
  amounts?: Record<string, string>;
  statuses?: Record<string, string>;
  links?: boolean;
};

const sourceChecks: SourceCheck[] = [
  {
    table: "projects",
    kinds: ["settings"],
    amounts: { budget_limit: "budget" },
  },
  {
    table: "project_tasks",
    kinds: ["tasks"],
    fields: { title: "title", starts_on: "start", due_on: "end" },
    statuses: {
      "": "todo",
      미시작: "todo",
      "진행 중": "in_progress",
      완료: "done",
      보류: "on_hold",
    },
  },
  {
    table: "project_decisions",
    kinds: ["decisions"],
    fields: { question: "title", due_on: "end" },
    statuses: {
      "": "discussing",
      "논의 중": "discussing",
      "결정 완료": "decided",
      보류: "on_hold",
    },
  },
  {
    table: "project_reservations",
    kinds: ["reservations"],
    fields: { title: "title", starts_on: "start", ends_on: "end" },
    amounts: { total_amount: "cost", paid_amount: "deposit" },
    statuses: {
      "": "reviewing",
      "검토 중": "reviewing",
      "예약 예정": "planned",
      "예약 완료": "booked",
      취소: "cancelled",
    },
    links: true,
  },
  {
    table: "project_itinerary",
    kinds: ["itinerary"],
    fields: { title: "title", starts_on: "start", ends_on: "end" },
    links: true,
  },
  {
    table: "project_expenses",
    kinds: ["expenses"],
    fields: { title: "title", planned_on: "planDate", paid_on: "paidDate" },
    amounts: { estimated_amount: "estimate", actual_amount: "actual" },
    links: true,
  },
  {
    table: "project_list_items",
    kinds: [
      "family",
      "contacts",
      "restaurants",
      "gifts",
      "travel",
      "references",
    ],
    fields: { title: "title" },
    amounts: { price: "cost" },
    statuses: {
      "": "candidate",
      후보: "candidate",
      선택: "selected",
      제외: "excluded",
    },
    links: true,
  },
];
for (const { kind } of snapshot.records) {
  if (sourceChecks.filter(({ kinds }) => kinds.includes(kind)).length !== 1) {
    throw new Error(`${kind} 원본 종류의 대조 규칙이 정확히 하나여야 합니다.`);
  }
}

function sourceTagLabels(value = "") {
  return [
    ...new Set(
      value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ];
}

function storedTagLabels(column: "tags" | "done_tags") {
  return `to_jsonb(array(
    select (select definition->>'label' from jsonb_array_elements(list.tags) as definition
      where definition->>'key' = tag.key)
    from unnest(stored.${column}) with ordinality as tag(key, position)
    order by tag.position
  ))`;
}

// Check the snapshot directly so a mapping error cannot also change the expected values.
function reconcileSource(check: SourceCheck) {
  const { table, kinds, fields = {}, amounts = {}, statuses, links } = check;
  const isList = table === "project_list_items";
  const records = snapshot.records
    .filter(({ kind }) => kinds.includes(kind))
    .map(({ id, kind, data }) => {
      const expected: Record<string, unknown> = {};
      for (const [column, field] of Object.entries(fields))
        expected[column] = data[field] || null;
      for (const [column, field] of Object.entries(amounts)) {
        expected[column] = data[field] ? Number(data[field]) : null;
      }
      if (links) expected.links = data.url ? [data.url] : [];
      if (kind === "settings") {
        expected.description = [
          data.notes,
          `wedd 설정 이름: ${data.title}`,
          data.ratio && `이전 분담 비율: ${data.ratio}`,
          data.benefitMode && `이전 복지카드 처리 기준: ${data.benefitMode}`,
        ]
          .filter(Boolean)
          .join("\n");
      }
      if (kind === "reservations") {
        expected.memo = [
          data.notes,
          data.owner && `담당: ${data.owner}`,
          data.resource && `겹침 확인 대상: ${data.resource}`,
          data.deadline && `무료 취소 / 결제 마감: ${data.deadline}`,
        ]
          .filter(Boolean)
          .join("\n");
      }
      if (isList) {
        expected.list_ref = `wedd:lists/${kind}`;
        const tags = sourceTagLabels(data.tags);
        const done = sourceTagLabels(data.doneTags);
        const doneLabels =
          !done.length && data.giftDone === "전달 완료" ? ["답례품"] : done;
        expected.tag_labels = tags;
        expected.done_tag_labels = tags.filter((label) =>
          doneLabels.includes(label),
        );
      }
      if (kind === "family" || kind === "contacts") {
        expected.status = null;
      } else if (kind === "travel") {
        expected.status =
          data.status === "루트 포함" ? "selected" : "candidate";
        expected.travel_status = data.status || null;
      } else if (statuses) {
        const label = data.status ?? "";
        if (!Object.hasOwn(statuses, label)) {
          throw new Error(`${kind} 원본 상태의 대조 규칙이 없습니다.`);
        }
        expected.status = statuses[label];
      }
      return { source_ref: `wedd:records/${id}`, fields: expected };
    });
  if (!records.length) return "";
  const listJoin = isList
    ? `left join public.project_lists as list
    on list.id = stored.list_id and list.family_id = stored.family_id`
    : "";
  const actual = isList
    ? `to_jsonb(stored) || jsonb_build_object(
      'list_ref', list.source_ref,
      'tag_labels', ${storedTagLabels("tags")},
      'done_tag_labels', ${storedTagLabels("done_tags")},
      'travel_status', stored."values"->(
        select definition->>'key' from jsonb_array_elements(list.columns) as definition
        where definition->>'label' = '여행 상태'
      )
    )`
    : "to_jsonb(stored)";
  return `
  select count(*) into mismatches
  from jsonb_to_recordset(${sqlLiteral(records)}::jsonb) as source(source_ref text, fields jsonb)
  left join ${qualified(table)} as stored
    on stored.family_id = ${family} and stored.source_ref = source.source_ref
    and (${projectScope(table)})
  ${listJoin}
  where stored.id is null or exists (
    select from jsonb_each(source.fields) as field(key, value)
    where (${actual})->field.key is distinct from field.value
  );
  if mismatches <> 0 then
    raise exception '${table} wedd 원본 대조 실패 (%개 불일치)', mismatches;
  end if;`;
}

function reconcile(table: Table) {
  const records = rows.get(table) ?? [];
  const keys = (records[0] ? Object.keys(records[0]) : [])
    .map(sqlLiteral)
    .join(", ");
  const amountFields: Partial<Record<Table, string[]>> = {
    projects: ["budget_limit"],
    project_reservations: ["total_amount", "paid_amount"],
    project_expenses: ["estimated_amount", "actual_amount"],
    project_list_items: ["price"],
  };
  const totals = (amountFields[table] ?? [])
    .map(
      (column) => `
  if (select sum(${column}) from ${typedRows(table, records)}) is distinct from (
    select sum(${column}) from ${qualified(table)} as stored
    where stored.family_id = ${family} and (${projectScope(table)})
  ) then
    raise exception '${table}.${column} 금액 합계 불일치';
  end if;`,
    )
    .join("");
  return `
  select count(*), count(*) filter (where expected.id is null or actual.id is null or exists (
    select from jsonb_each(to_jsonb(expected)) as field(key, value)
    where field.key = any(array[${keys}]::text[])
      and to_jsonb(actual)->field.key is distinct from field.value
  ))
  into compared, mismatches
  from ${typedRows(table, records)} as expected
  full join (
    select stored.* from ${qualified(table)} as stored
    where stored.family_id = ${family}
      and (stored.source_ref like 'wedd:%' or (${projectScope(table)}))
  ) as actual on actual.source_ref = expected.source_ref;
  if compared <> ${records.length} or mismatches <> 0 then
    raise exception '${table} 대조 실패 (기대 %, 대조 %, 불일치 %)', ${records.length}, compared, mismatches;
  end if;${totals}
  raise notice '${table} %개 일치', compared;`;
}

const listCounts = (rows.get("project_lists") ?? []).map((list) => {
  const expected = (rows.get("project_list_items") ?? []).filter(
    (item) => item.list_id === list.id,
  ).length;
  return `
  select count(*) into compared from public.project_list_items
  where family_id = ${family} and list_id = ${sqlLiteral(list.id)};
  if compared <> ${expected} then
    raise exception '% 개수 불일치 (기대 %, 실제 %)', ${sqlLiteral(list.name)}, ${expected}, compared;
  end if;
  raise notice '% %개 일치', ${sqlLiteral(list.name)}, compared;`;
});

const compareBody = `declare
  compared integer;
  mismatches integer;
begin
${[...sourceChecks.map(reconcileSource), ...tableNames.map(reconcile), ...listCounts].join("\n")}
end;
`;
const compare = `do ${sqlLiteral(compareBody)};`;

const preventRepeatImport = `
begin
  if exists (
    select from public.projects
    where family_id = ${family} and source_ref = ${projectSource}
  ) then
    raise exception '이미 이전된 프로젝트입니다. 확인에는 compare-wedd.sql을 실행하세요.';
  end if;
end;
`;

const verifyMembers = `
begin
  if not exists (
    select from public.memberships m join public.users u on u.id = m.user_id
    where m.family_id = ${family} and m.user_id = ${sqlLiteral(target.hyerimId)} and u.display_name = '헤줄'
    for share of m, u
  ) or not exists (
    select from public.memberships m join public.users u on u.id = m.user_id
    where m.family_id = ${family} and m.user_id = ${sqlLiteral(target.taehyunId)} and u.display_name = '데굴'
    for share of m, u
  ) then
    raise exception '이전 대상 가정에서 헤줄·데굴 계정을 확인할 수 없습니다.';
  end if;
end;
`;

const rollbackDependencies = {
  project_photos: { item_id: "project_list_items" },
  project_candidate_recipients: {
    candidate_id: "project_list_items",
    person_id: "project_list_items",
  },
  project_candidate_votes: { candidate_id: "project_list_items" },
  project_decision_opinion_reactions: {
    opinion_id: "project_decision_opinions",
  },
} satisfies Record<string, Record<string, Table>>;

const dependencyGuard = Object.entries(rollbackDependencies)
  .flatMap(([child, references]) =>
    Object.entries(references).map(
      ([column, parent]) => `
  if exists (
    select from ${qualified(child)} as child
    join ${qualified(parent)} as parent on child.${column} = parent.id and child.family_id = parent.family_id
    where parent.family_id = ${family} and parent.source_ref like 'wedd:%'
  ) then
    raise exception '${child}에 연결된 항목이 있어 되돌릴 수 없습니다.';
  end if;`,
    ),
  )
  .join("");
const deleteRows = [...tableNames].reverse().flatMap((table) => {
  const records = rows.get(table) ?? [];
  if (!records.length) return [];
  return [
    `delete from ${qualified(table)} where family_id = ${family}
  and source_ref in (select source_ref from ${typedRows(table, records)});`,
  ];
});
const lockTables = (
  names: string[],
) => `lock table ${names.map(qualified).join(", ")}
  in share row exclusive mode;`;

const files = {
  "import-wedd.sql": [
    "-- 적용 전에 기존 주간 백업과 wedd 쓰기 중지 시각을 확인하세요.",
    "-- 최종 내보내기 전에 Firestore 규칙으로 records 쓰기를 막았는지 확인하세요.",
    "-- 이전 뒤 다시 확인하려면 compare-wedd.sql을 실행하세요.",
    "-- 되돌리기에 대비해 실제 적용한 SQL이 들어 있는 출력 디렉터리를 보관하세요.",
    "begin;",
    lockTables(tableNames),
    `do ${sqlLiteral(preventRepeatImport)};`,
    `do ${sqlLiteral(verifyMembers)};`,
    ...tableNames.map((table) => insert(table, rows.get(table) ?? [])),
    compare,
    "commit;",
  ],
  "compare-wedd.sql": [
    "-- 모든 대조가 통과한 뒤에 wedd 운영 종료를 진행하세요.",
    "begin isolation level repeatable read read only;",
    compare,
    "commit;",
  ],
  "rollback-wedd.sql": [
    "-- import-wedd.sql을 실제 적용한 출력 디렉터리의 이 파일을 사용하세요.",
    "-- 반영 뒤의 편집이나 새로 연결된 데이터가 있으면 되돌리기가 중단됩니다.",
    "begin;",
    lockTables([...tableNames, ...Object.keys(rollbackDependencies)]),
    compare,
    `do ${sqlLiteral(`begin\n${dependencyGuard}\nend;`)};`,
    ...deleteRows,
    "commit;",
  ],
};

const directory = await mkdtemp("/tmp/kimjipsa-wedd-");
for (const [file, statements] of Object.entries(files)) {
  await writeFile(
    join(directory, file),
    statements.filter(Boolean).join("\n\n") + "\n",
    {
      flag: "wx",
      mode: 0o600,
    },
  );
}
console.info(directory);
console.error(
  "되돌리기에 대비해 실제 적용한 SQL의 출력 디렉터리를 보관하세요.",
);
console.error(
  "이전과 되돌리기 확인이 끝나면 " +
    "/tmp의 개인정보 스냅샷과 SQL 출력 디렉터리를 삭제하세요.",
);
