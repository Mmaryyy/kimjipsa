import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  projectListInput,
  projectListItemInput,
  projectListLinks,
  validProjectValues,
  type ProjectColumn,
} from "../src/entities/project/model/project-list.schema.ts";

const timestamp = z.iso.datetime({ offset: true });
const sourceRecord = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .refine(
      (id) =>
        !id.includes("/") &&
        [...id].every((character) => {
          const code = character.charCodeAt(0);
          return code >= 32 && code !== 127;
        }),
    ),
  kind: z.string(),
  version: z.int().positive(),
  updatedAt: timestamp,
  updatedBy: z.string().optional(),
  data: z.record(
    z.string(),
    z
      .string()
      .max(5000)
      .refine((value) => !value.includes("\0") && value.isWellFormed()),
  ),
});

export const snapshotSchema = z.strictObject({
  writeStoppedAt: timestamp,
  records: z.array(sourceRecord).min(1),
});

const uuid = z.uuid().transform((value) => value.toLowerCase());

export const targetSchema = z
  .strictObject({
    familyId: uuid,
    hyerimId: uuid,
    taehyunId: uuid,
  })
  .refine(({ hyerimId, taehyunId }) => hyerimId !== taehyunId);

type Target = z.infer<typeof targetSchema>;
type Snapshot = z.infer<typeof snapshotSchema>;
type Data = z.infer<typeof sourceRecord>["data"];

export const tables = {
  projects: null,
  project_areas: "project_id",
  project_milestones: "project_id",
  project_tasks: "project_id",
  project_decisions: "project_id",
  project_decision_opinions: "decision_id",
  project_lists: "project_id",
  project_list_items: "list_id",
  project_reservations: "project_id",
  project_itinerary: "project_id",
  project_expenses: "project_id",
} as const;

export type Table = keyof typeof tables;
export type Row = {
  id: string;
  family_id: string;
  source_ref: string;
} & Record<string, unknown>;
export type Rows = Map<Table, Row[]>;

const areas = [
  "전체 계획",
  "신혼여행",
  "웨딩스냅",
  "상견례",
  "가족 식사",
  "기타",
];

// HANDOFF §3. Keep the original wording where the source only gives a rough period.
const milestones = [
  [
    "전체 예산, 연차·경조휴가 및 증빙, 동생 부부 일정 확인",
    "2026-11-01",
    "2026-11-30",
    "",
    "전체 계획",
  ],
  [
    "여행 루트 결정, 항공 가격 모니터링, 스냅 장소·숙소 예약",
    "2026-12-01",
    "2026-12-31",
    "",
    "전체 계획",
  ],
  [
    "복지카드 충전 후 항공 예매, 여행 숙소·이동편 예약, 스냅 준비",
    "2027-01-01",
    "2027-01-31",
    "",
    "전체 계획",
  ],
  [
    "스냅 준비 완료, 상견례 날짜·장소 확정 및 식당 예약",
    "2027-02-01",
    "2027-02-28",
    "",
    "전체 계획",
  ],
  ["웨딩스냅 촬영", "2027-02-27", "2027-03-01", "", "웨딩스냅"],
  ["상견례", null, null, "2027.03.27 또는 04.03", "상견례"],
  ["사진 보정 및 기타 결혼 준비 완료", null, null, "2027.03~04 중순", "기타"],
  ["여행 최종 준비", null, null, "2027.04 중순~출국 전", "신혼여행"],
  ["유럽 신혼여행", "2027-04-28", "2027-05-16", "", "신혼여행"],
] as const;

const taskStatuses = {
  미시작: "todo",
  "진행 중": "in_progress",
  완료: "done",
  보류: "on_hold",
};
const decisionStatuses = {
  "논의 중": "discussing",
  "결정 완료": "decided",
  보류: "on_hold",
};
const reservationStatuses = {
  "검토 중": "reviewing",
  "예약 예정": "planned",
  "예약 완료": "booked",
  취소: "cancelled",
};
const candidateStatuses = {
  후보: "candidate",
  선택: "selected",
  제외: "excluded",
};
const travelStatuses = {
  희망: "candidate",
  "루트 포함": "selected",
  보류: "candidate",
};
const contactTags = ["게임", "별도 연락", "만남", "답례품"];

const listDefinitions = {
  family: {
    name: "가족 명단",
    kind: "people",
    columns: {
      side: ["소속", "혜림", "태현"],
      meeting: ["상견례 참석", "미정", "참석", "불참"],
      dinner: ["가족 식사 참석", "미정", "참석", "불참"],
      location: ["출발 지역"],
      mobility: ["이동 / 접근성"],
      diet: ["선호 메뉴 / 식이 제한"],
    },
  },
  contacts: {
    name: "결혼 소식",
    kind: "people",
    columns: { side: ["소속", "혜림", "태현"] },
  },
  restaurants: {
    name: "식당 후보",
    kind: "candidates",
    columns: {
      project: ["행사", "상견례", "가족 식사"],
      address: ["주소"],
      menu: ["메뉴"],
      parking: ["주차 / 엘리베이터 / 개별실"],
    },
  },
  gifts: {
    name: "답례품 후보",
    kind: "candidates",
    columns: { priceNote: ["가격 범위 / 포장 정보"] },
  },
  travel: {
    name: "여행 희망지",
    kind: "candidates",
    columns: {
      country: ["나라"],
      nights: ["숙박 일수"],
      status: ["여행 상태", ...Object.keys(travelStatuses)],
    },
  },
  references: {
    name: "스냅 레퍼런스",
    kind: "candidates",
    columns: {
      category: [
        "분류",
        "촬영 장소",
        "콘셉트",
        "의상",
        "헤어메이크업",
        "소품",
        "우천 대안",
      ],
    },
  },
} as const;

const fields = {
  settings: "budget ratio benefitMode",
  tasks: "project owner status start end depends",
  decisions: "project status end choice hyerim taehyun",
  reservations:
    "project status start end resource reference url deadline cost deposit owner",
  expenses:
    "project estimate planDate actual paidDate payer benefit shared url",
  itinerary: "start end city resource url",
  family: "",
  contacts: "tags doneTags status giftDone",
  restaurants: "status cost url",
  gifts: "status cost url",
  travel: "url",
  references: "status url",
} as const;

type Kind = keyof typeof fields;
type ListKind = keyof typeof listDefinitions;

function stableId(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function limited(value = "", maximum = 1000) {
  if ([...value].length > maximum)
    throw new Error(`대상 길이 제한 초과 (${maximum}자)`);
  return value;
}

function date(value?: string) {
  return value ? z.iso.date().parse(value) : null;
}

function amount(value?: string, integer = false) {
  if (!value) return null;
  const number = Number(value);
  if (
    !value.trim() ||
    !Number.isFinite(number) ||
    number < 0 ||
    number > Number.MAX_SAFE_INTEGER ||
    (integer && !Number.isSafeInteger(number))
  ) {
    throw new Error("대상에 저장할 수 없는 숫자입니다.");
  }
  return number;
}

function mapped(
  values: Record<string, string>,
  value: string,
  fallback: string,
) {
  if (!value) return fallback;
  if (!Object.hasOwn(values, value))
    throw new Error("알 수 없는 선택 값입니다.");
  return values[value];
}

function memo(notes?: string, ...details: [string, string | undefined][]) {
  const lines = details
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);
  return limited([notes, ...lines].filter(Boolean).join("\n"));
}

function links(data: Data) {
  const original = data.url ? [data.url] : [];
  projectListLinks.parse(original);
  if (data.url && /\s/.test(data.url))
    throw new Error("링크에 공백이 있습니다.");
  return original;
}

function splitTags(value = "") {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function mapWedd(snapshot: Snapshot, target: Target): Rows {
  const rows: Rows = new Map();
  const { familyId, hyerimId, taehyunId } = target;
  const memberIds = new Map([
    ["혜림", hyerimId],
    ["태현", taehyunId],
  ]);
  const records = [...snapshot.records].sort((a, b) =>
    a.id < b.id ? -1 : Number(a.id !== b.id),
  );
  const settings = records.filter(({ kind }) => kind === "settings");
  if (settings.length !== 1)
    throw new Error("wedd 설정 문서가 정확히 하나여야 합니다.");
  if (new Set(records.map(({ id }) => id)).size !== records.length)
    throw new Error("중복된 원본 문서 ID가 있습니다.");

  const id = (key: string) => stableId(`${familyId}:${key}`);
  const add = (
    table: Table,
    source_ref: string,
    values: Record<string, unknown>,
  ) => {
    const row: Row = {
      id: id(source_ref),
      family_id: familyId,
      source_ref,
      ...values,
    };
    const existing = rows.get(table) ?? [];
    existing.push(row);
    rows.set(table, existing);
    return row.id;
  };
  const recordRef = (recordId: string) => `wedd:records/${recordId}`;
  const area = (name?: string) => {
    if (!name) return null;
    if (!areas.includes(name)) throw new Error("알 수 없는 원본 영역입니다.");
    return id(`wedd:areas/${name}`);
  };
  const member = (name = "") => {
    if (!name || name === "미정") return null;
    const userId = memberIds.get(name);
    if (!userId) throw new Error("알 수 없는 원본 구성원입니다.");
    return userId;
  };

  const setting = settings[0].data;
  const projectId = add("projects", recordRef(settings[0].id), {
    title: "결혼 준비",
    status: "active",
    starts_on: null,
    target_on: null,
    created_by: null,
    description: memo(
      setting.notes,
      ["wedd 설정 이름", setting.title],
      ["이전 분담 비율", setting.ratio],
      ["이전 복지카드 처리 기준", setting.benefitMode],
    ),
    modules: ["decisions", "lists", "reservations", "itinerary", "budget"],
    budget_limit: amount(setting.budget, true),
  });
  const parent = { project_id: projectId };
  areas.forEach((name, sort_order) =>
    add("project_areas", `wedd:areas/${name}`, { ...parent, name, sort_order }),
  );
  milestones.forEach(([title, starts_on, ends_on, memo, areaName], index) =>
    add("project_milestones", `wedd:milestones/${index + 1}`, {
      ...parent,
      title,
      starts_on,
      ends_on,
      is_tentative: starts_on === null,
      memo,
      area_id: area(areaName),
      event_id: null,
    }),
  );

  const listIds = new Map<ListKind, string>();
  const listColumns = new Map<ListKind, Map<string, ProjectColumn>>();
  const tagId = (label: string) => {
    if (!contactTags.includes(label))
      throw new Error("알 수 없는 원본 연락 태그입니다.");
    return id(`wedd:tags/contacts/${label}`);
  };
  for (const [sort_order, kind] of (
    Object.keys(listDefinitions) as ListKind[]
  ).entries()) {
    const definition = listDefinitions[kind];
    const columns = new Map<string, ProjectColumn>();
    for (const [field, [label, ...options]] of Object.entries(
      definition.columns,
    )) {
      const type = options.length
        ? "select"
        : field === "nights"
          ? "number"
          : "text";
      columns.set(field, {
        key: id(`wedd:columns/${kind}/${field}`),
        label,
        type,
        options,
      });
    }
    const list = projectListInput.parse({
      name: definition.name,
      kind: definition.kind,
      columns: [...columns.values()],
      tags:
        kind === "contacts"
          ? contactTags.map((label) => ({ key: tagId(label), label }))
          : [],
      quantity_list_id: kind === "gifts" ? listIds.get("contacts") : null,
      quantity_tag_key: kind === "gifts" ? tagId("답례품") : null,
    });
    listColumns.set(kind, columns);
    listIds.set(
      kind,
      add("project_lists", `wedd:lists/${kind}`, {
        ...parent,
        ...list,
        sort_order,
      }),
    );
  }

  const listOrder = new Map<ListKind, number>();
  for (const record of records) {
    try {
      const { data: d } = record;
      if (!Object.hasOwn(fields, record.kind))
        throw new Error("알 수 없는 원본 종류입니다.");
      const kind = record.kind as Kind;
      const columns = listColumns.get(kind as ListKind);
      const known = new Set([
        "title",
        "notes",
        ...fields[kind].split(" ").filter(Boolean),
        ...(columns?.keys() ?? []),
      ]);
      if (Object.keys(d).some((key) => !known.has(key)))
        throw new Error("알 수 없는 원본 필드입니다.");
      if (!d.title?.trim()) throw new Error("원본 제목이 비어 있습니다.");
      const title = limited(d.title, 100);
      const ref = recordRef(record.id);
      switch (kind) {
        case "settings":
          break;
        case "tasks": {
          const status = mapped(taskStatuses, d.status, "todo");
          const assignee = d.owner === "함께" ? null : member(d.owner);
          add("project_tasks", ref, {
            ...parent,
            title,
            status,
            area_id: area(d.project),
            assignee_kind: assignee
              ? "member"
              : d.owner === "함께"
                ? "together"
                : "unassigned",
            assignee_id: assignee,
            starts_on: date(d.start),
            due_on: date(d.end),
            depends_note: limited(d.depends),
            memo: limited(d.notes),
            completed_at: status === "done" ? record.updatedAt : null,
            completed_by: null,
          });
          break;
        }
        case "decisions": {
          const status = mapped(decisionStatuses, d.status, "discussing");
          const context = memo(d.notes, ["wedd 영역", d.project]);
          const decisionId = add("project_decisions", ref, {
            ...parent,
            question: title,
            status,
            due_on: date(d.end),
            options:
              status === "decided"
                ? context
                : memo(d.choice, ["wedd 참고", context]),
            final_choice: status === "decided" ? limited(d.choice) : "",
          });
          for (const [key, userId] of [
            ["hyerim", hyerimId],
            ["taehyun", taehyunId],
          ]) {
            if (d[key])
              add("project_decision_opinions", `${ref}/opinions/${key}`, {
                decision_id: decisionId,
                user_id: userId,
                opinion: limited(d[key]),
              });
          }
          break;
        }
        case "reservations":
          add("project_reservations", ref, {
            ...parent,
            title,
            area_id: area(d.project),
            kind: "other",
            status: mapped(reservationStatuses, d.status, "reviewing"),
            starts_on: date(d.start),
            ends_on: date(d.end),
            reference_no: limited(d.reference, 100),
            links: links(d),
            cancel_deadline: null,
            payment_deadline: null,
            total_amount: amount(d.cost),
            paid_amount: amount(d.deposit),
            event_id: null,
            memo: memo(
              d.notes,
              ["담당", d.owner],
              ["겹침 확인 대상", d.resource],
              ["무료 취소 / 결제 마감", date(d.deadline) ?? undefined],
            ),
          });
          break;
        case "expenses": {
          const actual = amount(d.actual, true);
          const payer = member(d.payer);
          if (actual !== null && (!d.paidDate || !payer))
            throw new Error("실제 지출의 결제일 또는 결제자가 비어 있습니다.");
          add("project_expenses", ref, {
            ...parent,
            title,
            area_id: area(d.project),
            estimated_amount: amount(d.estimate, true),
            planned_on: date(d.planDate),
            actual_amount: actual,
            paid_on: date(d.paidDate),
            payer_id: payer,
            links: links(d),
            memo: memo(
              d.notes,
              ["복지카드 사용액(원)", d.benefit],
              ["이전 비용 구분", d.shared],
            ),
          });
          break;
        }
        case "itinerary":
          add("project_itinerary", ref, {
            ...parent,
            title,
            starts_on: z.iso.date().parse(d.start),
            ends_on: date(d.end),
            place: limited(d.city),
            links: links(d),
            memo: memo(d.notes, ["겹침 확인 대상", d.resource]),
            event_id: null,
          });
          break;
        default: {
          if (!columns) throw new Error("대상 목록을 찾을 수 없습니다.");
          const list_id = listIds.get(kind);
          const sort_order = listOrder.get(kind) ?? 0;
          listOrder.set(kind, sort_order + 1);
          const isPeople = listDefinitions[kind].kind === "people";
          const tags = splitTags(d.tags);
          const explicitDone = splitTags(d.doneTags);
          const done =
            !explicitDone.length && d.giftDone === "전달 완료"
              ? ["답례품"]
              : explicitDone;
          const doneTags = tags.filter((tag) => done.includes(tag));
          const values = Object.fromEntries(
            [...columns].flatMap(([key, column]) => {
              if (!d[key]) return [];
              return [
                [
                  column.key,
                  column.type === "number" ? amount(d[key]) : d[key],
                ],
              ];
            }),
          );
          const statusMap =
            kind === "travel" ? travelStatuses : candidateStatuses;
          const status = isPeople
            ? null
            : mapped(statusMap, d.status, "candidate");
          const item = {
            title,
            status,
            price: amount(d.cost),
            links: links(d),
            values,
            tags: tags.map(tagId),
            done_tags: doneTags.map(tagId),
            memo: memo(
              d.notes,
              ["wedd 전달 상태", d.giftDone ? d.status : undefined],
              ["wedd 답례품 전달", d.giftDone],
              [
                "wedd 원본 완료 태그",
                explicitDone.some((tag) => !tags.includes(tag))
                  ? d.doneTags
                  : undefined,
              ],
            ),
          };
          projectListItemInput.parse(item);
          if (
            !validProjectValues(
              [...columns.values()],
              item.values as Record<string, string | number>,
            )
          ) {
            throw new Error("대상 사용자 정의 칸에 저장할 수 없는 값입니다.");
          }
          add("project_list_items", ref, { ...item, list_id, sort_order });
        }
      }
    } catch (error) {
      throw new Error(`${record.id} (${record.kind}) 매핑 실패`, {
        cause: error,
      });
    }
  }
  const importedRecords = [...rows.values()].flatMap((tableRows) =>
    tableRows
      .map(({ source_ref }) => source_ref)
      .filter((ref) => /^wedd:records\/[^/]+$/.test(ref)),
  );
  assert.deepEqual(
    importedRecords.sort(),
    records.map(({ id }) => recordRef(id)),
  );
  return rows;
}
