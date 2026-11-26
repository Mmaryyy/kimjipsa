import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/shared/api";
import { mockJson } from "@/shared/server";
import { itineraryRow, type ProjectDecision, type ProjectMember } from "./type";
import type { ProjectModuleCommand } from "../model/project.schema";
import type { ProjectStore } from "./mock.server";

export function moduleFixtures(
  project_id: string,
  areas: { travel: string; photos: string; meeting: string },
  members: ProjectMember[],
  date: (offset: number) => string,
) {
  const [first, second] = members;
  function opinion(
    member: ProjectMember | undefined,
    text: string,
    reactions: ProjectDecision["opinions"][number]["reactions"] = [],
  ): ProjectDecision["opinions"] {
    return member
      ? [
          {
            id: randomUUID(),
            user_id: member.user_id,
            opinion: text,
            reactions,
          },
        ]
      : [];
  }
  const reservation = {
    project_id,
    area_id: areas.travel,
    kind: "lodging",
    starts_on: null,
    ends_on: null,
    reference_no: "",
    links: [],
    cancel_deadline: null,
    payment_deadline: null,
    total_amount: null,
    paid_amount: null,
    memo: "",
    event_id: null,
  } satisfies Partial<ProjectStore["reservations"][number]>;
  return {
    decisions: [
      {
        id: randomUUID(),
        project_id,
        question: "상견례 날짜를 언제로 할까?",
        status: "discussing",
        due_on: date(-2),
        options: "토요일 점심\n다음 주 토요일 저녁",
        final_choice: "",
        opinions: opinion(first, "첫 토요일이 부모님 일정상 더 편해요."),
      },
      {
        id: randomUUID(),
        project_id,
        question: "예식 시간대는?",
        status: "discussing",
        due_on: date(3),
        options: "11시\n13시 30분",
        final_choice: "",
        opinions: [
          ...opinion(
            first,
            "멀리서 오는 친척을 생각하면 13시 30분.",
            second ? [{ user_id: second.user_id, reaction: "up" }] : [],
          ),
          ...opinion(second, "식대가 싼 11시도 괜찮아."),
        ],
      },
      {
        id: randomUUID(),
        project_id,
        question: "폐백을 할까?",
        status: "on_hold",
        due_on: null,
        options: "한다\n안 한다",
        final_choice: "",
        opinions: [],
      },
      {
        id: randomUUID(),
        project_id,
        question: "신혼여행지",
        status: "decided",
        due_on: null,
        options: "파리 + 로마\n포르투갈 일주",
        final_choice: "파리 4박 + 로마 4박",
        opinions: [
          ...opinion(first, "파리는 꼭 가고 싶어요."),
          ...opinion(second, "로마도 넣자."),
        ],
      },
    ],
    reservations: [
      {
        ...reservation,
        id: randomUUID(),
        status: "booked",
        title: "파리 강변 숙소",
        starts_on: date(153),
        ends_on: date(157),
        reference_no: "HX-29481",
        links: ["https://example.com/reservation"],
        cancel_deadline: date(-2),
        payment_deadline: date(145),
        total_amount: 1840000,
        paid_amount: 600000,
        memo: "도착 시간 확인하기",
      },
      {
        ...reservation,
        id: randomUUID(),
        status: "reviewing",
        title: "파리 작은 호텔",
        starts_on: date(155),
        ends_on: date(157),
        total_amount: 980000,
        memo: "강변 숙소 대신 후보",
      },
      {
        ...reservation,
        id: randomUUID(),
        kind: "transport",
        status: "planned",
        title: "파리 → 로마 기차",
        starts_on: date(157),
        payment_deadline: date(14),
        total_amount: 312000,
        paid_amount: 100000,
      },
      {
        ...reservation,
        id: randomUUID(),
        status: "planned",
        title: "로마 숙소",
        starts_on: date(157),
        ends_on: date(161),
        cancel_deadline: date(5),
        payment_deadline: date(126),
        total_amount: 1260000,
        paid_amount: 260000,
      },
      {
        ...reservation,
        id: randomUUID(),
        area_id: areas.photos,
        kind: "activity",
        status: "booked",
        title: "웨딩스냅 스튜디오",
        starts_on: date(93),
        reference_no: "SN-0227",
        payment_deadline: date(86),
        total_amount: 1500000,
        paid_amount: 300000,
      },
      {
        ...reservation,
        id: randomUUID(),
        area_id: areas.meeting,
        kind: "restaurant",
        status: "reviewing",
        title: "상견례 한정식집",
        memo: "날짜 정해지면 예약",
      },
      {
        ...reservation,
        id: randomUUID(),
        status: "cancelled",
        title: "이전 숙소",
        starts_on: date(153),
        ends_on: date(156),
        total_amount: 1520000,
        paid_amount: 0,
      },
    ],
    itinerary: [
      { title: "파리 도착", starts_on: date(153), place: "샤를 드골 공항" },
      {
        title: "체크인 후 센강 산책",
        starts_on: date(153),
        place: "파리 강변 숙소",
      },
      {
        title: "오르세미술관",
        starts_on: date(154),
        place: "오르세미술관",
        memo: "온라인 예매",
      },
      { title: "몽마르트르 언덕", starts_on: date(155), place: "몽마르트르" },
      { title: "로마로 이동", starts_on: date(157), place: "파리 리옹역" },
      {
        title: "바티칸 투어",
        starts_on: date(158),
        ends_on: date(159),
        place: "바티칸",
      },
    ].map((row) => ({
      id: randomUUID(),
      project_id,
      ends_on: null,
      memo: "",
      links: [],
      event_id: null,
      ...row,
    })),
  } satisfies Pick<ProjectStore, "decisions" | "reservations" | "itinerary">;
}

export type CreateProjectMockEvent = (item: {
  title: string;
  place: string;
  memo: string;
  startDate: string;
  endDate: string;
}) => Promise<string>;

const pendingEvents = new WeakMap<object, Promise<string>>();

export async function clearMockProjectLinks(store: ProjectStore) {
  const sharedIds = new Set(
    (await mockJson("events"))
      .filter((event) => event.visibility === "shared")
      .map((event) => event.id),
  );
  for (const row of [
    ...store.milestones,
    ...store.reservations,
    ...store.itinerary,
  ]) {
    if (row.event_id && !sharedIds.has(row.event_id)) row.event_id = null;
  }
}

export async function writeProjectModuleMock(
  store: ProjectStore,
  command: ProjectModuleCommand,
  members: ProjectMember[],
  actor: string,
  createEvent: CreateProjectMockEvent,
) {
  const project_id = command.projectId;
  const project = store.projects.find((row) => row.id === project_id);
  const section =
    command.action === "add_project_event"
      ? command.source
      : command.action.endsWith("_decision") ||
          command.action === "save_decision_opinion" ||
          command.action === "set_decision_opinion_reaction"
        ? "decisions"
        : command.action.endsWith("_reservation")
          ? "reservations"
          : "itinerary";
  const missing = () =>
    new ApiError("project_not_found", "프로젝트 항목을 찾을 수 없어요.", 404);
  const invalid = () =>
    new ApiError(
      "invalid_project",
      "프로젝트 항목의 입력을 확인해 주세요.",
      400,
    );
  if (
    !project ||
    (section !== "milestones" && !project.modules.includes(section))
  )
    throw missing();
  const id = command.id ?? randomUUID();
  const matches = (row: { id: string; project_id: string }) =>
    row.id === id && row.project_id === project_id;
  const index = store[section].findIndex(matches);
  if (command.id && index < 0) throw missing();
  if (command.action === "add_project_event") {
    const row = store[command.source][index];
    await clearMockProjectLinks(store);
    if (!row.starts_on) throw invalid();
    if (!row.event_id) {
      const pending =
        pendingEvents.get(row) ??
        createEvent({
          title: row.title,
          place: "place" in row ? row.place : "",
          memo: row.memo,
          startDate: row.starts_on,
          endDate: row.ends_on ?? row.starts_on,
        });
      pendingEvents.set(row, pending);
      try {
        row.event_id = await pending;
      } finally {
        pendingEvents.delete(row);
      }
    }
    return id;
  }
  switch (command.action) {
    case "save_decision_opinion":
    case "set_decision_opinion_reaction": {
      if (!members.some(({ user_id }) => user_id === actor))
        throw new ApiError(
          "family_required",
          "가정에 먼저 참여해 주세요.",
          403,
        );
      const { opinions } = store.decisions[index];
      if (command.action === "save_decision_opinion") {
        const { opinion } = command.item;
        const prior = opinions.findIndex((entry) => entry.user_id === actor);
        if (opinion) {
          if (prior < 0)
            opinions.push({
              id: randomUUID(),
              user_id: actor,
              opinion,
              reactions: [],
            });
          else opinions[prior].opinion = opinion;
        } else if (prior >= 0) {
          opinions.splice(prior, 1);
        }
      } else {
        const target = opinions.find((entry) => entry.id === command.opinionId);
        if (!target?.user_id || target.user_id === actor) throw invalid();
        target.reactions = target.reactions.filter(
          ({ user_id }) => user_id !== actor,
        );
        if (command.reaction)
          target.reactions.push({ user_id: actor, reaction: command.reaction });
      }
      break;
    }
    case "save_decision": {
      const opinions = [...(store.decisions[index]?.opinions ?? [])];
      for (const { user_id, opinion } of command.item.opinions) {
        if (!members.some((member) => member.user_id === user_id))
          throw invalid();
        const prior = opinions.findIndex((entry) => entry.user_id === user_id);
        if (prior >= 0) {
          if (opinion) opinions[prior] = { ...opinions[prior], opinion };
          else opinions.splice(prior, 1);
        } else if (opinion) {
          opinions.push({ id: randomUUID(), user_id, opinion, reactions: [] });
        }
      }
      store.decisions.splice(
        index < 0 ? store.decisions.length : index,
        index < 0 ? 0 : 1,
        {
          ...command.item,
          id,
          project_id,
          opinions,
        },
      );
      break;
    }
    case "save_reservation": {
      const { area_id } = command.item;
      if (
        area_id &&
        !store.areas.some(
          (row) => row.id === area_id && row.project_id === project_id,
        )
      )
        throw invalid();
      const row = {
        ...command.item,
        id,
        project_id,
        event_id: store.reservations[index]?.event_id ?? null,
      };
      if (index < 0) store.reservations.push(row);
      else Object.assign(store.reservations[index], row);
      break;
    }
    case "save_itinerary": {
      const row = itineraryRow.parse({
        ...command.item,
        id,
        project_id,
        event_id: store.itinerary[index]?.event_id ?? null,
      });
      if (index < 0) store.itinerary.push(row);
      else Object.assign(store.itinerary[index], row);
      break;
    }
    case "delete_decision":
    case "delete_reservation":
    case "delete_itinerary":
      store[section].splice(index, 1);
      break;
  }
  return id;
}
