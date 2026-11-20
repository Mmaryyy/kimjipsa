import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/shared/api";
import { mockJson } from "@/shared/server";
import { itineraryRow, type ProjectMember } from "./type";
import type { ProjectModuleCommand } from "../model/project.schema";
import type { ProjectStore } from "./mock.server";

export function moduleFixtures(
  project_id: string,
  area_id: string,
  members: ProjectMember[],
) {
  const decisionId = randomUUID();
  const hotel = {
    project_id,
    area_id,
    kind: "lodging",
    status: "booked",
    title: "파리 작은 호텔",
    starts_on: "2027-04-28",
    ends_on: "2027-05-02",
    reference_no: "DEMO-0428",
    links: ["https://example.com/reservation"],
    cancel_deadline: "2027-04-20",
    payment_deadline: "2027-04-21",
    total_amount: 800000,
    paid_amount: 200000,
    memo: "도착 시간 확인하기",
    event_id: null,
  } as const;
  return {
    decisions: [
      {
        id: decisionId,
        project_id,
        question: "상견례 날짜를 언제로 할까?",
        status: "discussing",
        due_on: "2026-11-21",
        options: "2027.03.27 / 2027.04.03",
        final_choice: "",
        opinions: members.slice(0, 2).map(({ user_id }, index) => ({
          id: randomUUID(),
          user_id,
          opinion:
            index === 0
              ? "3월 말이면 가족들이 이동하기 좋을 것 같아."
              : "4월 첫 주도 괜찮아. 부모님 일정 확인할게.",
        })),
      },
      {
        id: randomUUID(),
        project_id,
        question: "웨딩스냅 장소",
        status: "decided",
        due_on: null,
        options: "",
        final_choice: "제주",
        opinions: [],
      },
    ],
    reservations: [
      { ...hotel, links: [...hotel.links], id: randomUUID() },
      {
        ...hotel,
        id: randomUUID(),
        status: "planned",
        title: "파리 강변 숙소",
        starts_on: "2027-04-30",
        ends_on: "2027-05-03",
        links: [],
      },
      {
        ...hotel,
        id: randomUUID(),
        kind: "transport",
        status: "planned",
        title: "파리 → 로마",
        starts_on: "2027-05-02",
        ends_on: null,
        links: [],
      },
      {
        ...hotel,
        id: randomUUID(),
        status: "cancelled",
        title: "이전 숙소",
        links: [],
      },
    ],
    itinerary: [
      {
        id: randomUUID(),
        project_id,
        title: "파리 도착",
        starts_on: "2027-04-28",
        ends_on: null,
        place: "샤를 드골 공항",
        memo: "숙소로 이동",
        links: [],
        event_id: null,
      },
      {
        id: randomUUID(),
        project_id,
        title: "오르세미술관",
        starts_on: "2027-04-29",
        ends_on: null,
        place: "파리",
        memo: "관람 후 강변 산책",
        links: [],
        event_id: null,
      },
    ],
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
  createEvent: CreateProjectMockEvent,
) {
  const project_id = command.projectId;
  const project = store.projects.find((row) => row.id === project_id);
  const section =
    command.action === "add_project_event"
      ? command.source
      : command.action.endsWith("_decision")
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
    case "save_decision": {
      const opinions = [...(store.decisions[index]?.opinions ?? [])];
      for (const { user_id, opinion } of command.item.opinions) {
        if (!members.some((member) => member.user_id === user_id))
          throw invalid();
        const prior = opinions.findIndex((entry) => entry.user_id === user_id);
        if (prior >= 0) opinions.splice(prior, 1);
        if (opinion) opinions.push({ id: randomUUID(), user_id, opinion });
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
