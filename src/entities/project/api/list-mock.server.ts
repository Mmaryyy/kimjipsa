import "server-only";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { ApiError } from "@/shared/api";
import {
  validProjectValues,
  type ProjectListCommand,
} from "../model/project-list.schema";
import { projectQuantitySource } from "../model/project-list.utils";
import type {
  CandidateVote,
  ProjectDetail,
  ProjectMember,
  ProjectPhoto,
} from "./type";
import type { ProjectStore } from "./mock.server";

type ListData = Pick<
  ProjectDetail,
  "lists" | "listItems" | "photos" | "candidateRecipients" | "candidateVotes"
>;

export function listFixtures(
  project_id: string,
  members: ProjectMember[],
): ListData & Pick<ProjectStore, "photoFiles"> {
  const peopleId = "c9f16be3-2edb-443f-8056-b7dc9a2954cb";
  const candidateId = "34230411-b9c9-497f-8f32-49c3b2f1c688";
  const teaId = randomUUID();
  const cookieId = randomUUID();
  const towelId = randomUUID();
  const mugId = randomUUID();
  const skyId = randomUUID();
  const seaId = randomUUID();
  const naraeId = randomUUID();
  const yujinId = randomUUID();
  const minseoId = randomUUID();
  const photoFiles: ProjectStore["photoFiles"] = new Map();
  const photos = [
    { itemId: teaId, file: "public/images/mock-candidate-tea.jpg" },
    { itemId: cookieId, file: "public/images/mock-candidate-cookie.jpg" },
    { itemId: towelId, file: "public/images/mock-candidate-towel.jpg" },
  ].map(({ itemId, file }) => {
    const id = randomUUID();
    const image = new Blob([new Uint8Array(readFileSync(file))], {
      type: "image/jpeg",
    });
    photoFiles.set(id, [image, image]);
    return { id, item_id: itemId };
  });
  const gift = { key: randomUUID(), label: "답례품" };
  const call = { key: randomUUID(), label: "별도 연락" };
  const meet = { key: randomUUID(), label: "만남" };
  const relationship = {
    key: randomUUID(),
    label: "관계",
    type: "text",
    options: [],
  } as const;
  const region = {
    key: randomUUID(),
    label: "지역",
    type: "select",
    options: ["광주", "안산", "포항"],
  } as const;
  const delivery = {
    key: randomUUID(),
    label: "배송일",
    type: "select",
    options: ["행사 3일 전", "행사 전날"],
  } as const;
  const fee = {
    key: randomUUID(),
    label: "배송비",
    type: "money",
    options: [],
  } as const;
  const empty = {
    links: [],
    price: null,
    status: null,
    values: {},
    tags: [],
    done_tags: [],
    memo: "",
  };
  return {
    lists: [
      {
        project_id,
        id: candidateId,
        name: "답례품 후보",
        kind: "candidates",
        sort_order: 0,
        columns: [
          { ...delivery, options: [...delivery.options] },
          { ...fee, options: [] },
        ],
        tags: [],
        quantity_list_id: peopleId,
        quantity_tag_key: gift.key,
      },
      {
        project_id,
        id: peopleId,
        name: "가족 명단",
        kind: "people",
        sort_order: 1,
        columns: [
          { ...relationship, options: [] },
          { ...region, options: [...region.options] },
        ],
        tags: [gift, call, meet],
        quantity_list_id: null,
        quantity_tag_key: null,
      },
    ],
    listItems: [
      {
        ...empty,
        list_id: candidateId,
        id: teaId,
        sort_order: 0,
        title: "작은 차 선물 세트",
        price: 12000,
        status: "candidate",
        links: ["https://smartstore.naver.com/teashop/products/123"],
        values: { [delivery.key]: "행사 3일 전", [fee.key]: 3000 },
        memo: "포장 색상 확인하기",
      },
      {
        ...empty,
        list_id: candidateId,
        id: cookieId,
        sort_order: 1,
        title: "수제 과자 상자",
        price: 9500,
        status: "candidate",
        links: ["https://www.idus.com/v2/product/abc"],
        memo: "아이 있는 집 위주로 준비하기",
      },
      {
        ...empty,
        list_id: candidateId,
        id: towelId,
        sort_order: 2,
        title: "호텔 수건 세트",
        price: 15000,
        status: "candidate",
      },
      {
        ...empty,
        list_id: candidateId,
        id: mugId,
        sort_order: 3,
        title: "머그 세트",
        price: 18000,
        status: "candidate",
        memo: "비교 후 제외",
      },
      {
        ...empty,
        list_id: peopleId,
        id: skyId,
        sort_order: 0,
        title: "김하늘",
        tags: [gift.key, call.key],
        done_tags: [gift.key],
        values: { [relationship.key]: "가족", [region.key]: "광주" },
        memo: "이동 일정 먼저 확인",
      },
      {
        ...empty,
        list_id: peopleId,
        id: seaId,
        sort_order: 1,
        title: "이바다",
        tags: [gift.key, meet.key],
        done_tags: [meet.key],
        values: { [relationship.key]: "가족", [region.key]: "안산" },
      },
      {
        ...empty,
        list_id: peopleId,
        id: naraeId,
        sort_order: 2,
        title: "박나래",
        tags: [gift.key, call.key, meet.key],
        done_tags: [call.key],
        values: { [relationship.key]: "이모", [region.key]: "포항" },
      },
      {
        ...empty,
        list_id: peopleId,
        id: yujinId,
        sort_order: 3,
        title: "정유진",
        tags: [gift.key, call.key],
        values: { [relationship.key]: "사촌", [region.key]: "광주" },
      },
      {
        ...empty,
        list_id: peopleId,
        id: minseoId,
        sort_order: 4,
        title: "최민서",
        tags: [gift.key, meet.key],
        values: { [relationship.key]: "고모", [region.key]: "안산" },
      },
      {
        ...empty,
        list_id: peopleId,
        id: randomUUID(),
        sort_order: 5,
        title: "한시우",
        tags: [gift.key],
        values: { [relationship.key]: "삼촌", [region.key]: "포항" },
      },
    ],
    photos,
    photoFiles,
    candidateRecipients: [
      { list_id: candidateId, candidate_id: teaId, person_id: skyId },
      { list_id: candidateId, candidate_id: teaId, person_id: naraeId },
      { list_id: candidateId, candidate_id: teaId, person_id: minseoId },
      { list_id: candidateId, candidate_id: cookieId, person_id: seaId },
      { list_id: candidateId, candidate_id: cookieId, person_id: yujinId },
    ],
    candidateVotes: members.flatMap<CandidateVote>(({ user_id }, index) => [
      { candidate_id: teaId, user_id, vote: "up" },
      { candidate_id: cookieId, user_id, vote: "up" },
      { candidate_id: mugId, user_id, vote: "down" },
      ...(members.length > 1
        ? [
            {
              candidate_id: towelId,
              user_id,
              vote: index === 0 ? ("up" as const) : ("down" as const),
            },
          ]
        : []),
    ]),
  };
}

export function projectListNotFound() {
  return new ApiError(
    "project_not_found",
    "프로젝트 항목을 찾을 수 없어요.",
    404,
  );
}

const invalid = () =>
  new ApiError("invalid_project", "프로젝트 항목의 입력을 확인해 주세요.", 400);

export function readMockLists(
  store: ProjectStore,
  projectId: string,
): ListData {
  if (
    !store.projects.some(
      (project) =>
        project.id === projectId && project.modules.includes("lists"),
    )
  )
    return {
      lists: [],
      listItems: [],
      photos: [],
      candidateRecipients: [],
      candidateVotes: [],
    };
  const lists = store.lists.filter((list) => list.project_id === projectId);
  const listIds = new Set(lists.map((list) => list.id));
  const listItems = store.listItems.filter((item) => listIds.has(item.list_id));
  const itemIds = new Set(listItems.map((item) => item.id));
  return {
    lists,
    listItems,
    photos: store.photos.filter((photo) => itemIds.has(photo.item_id)),
    candidateRecipients: store.candidateRecipients.filter(({ list_id }) =>
      listIds.has(list_id),
    ),
    candidateVotes: store.candidateVotes.filter(({ candidate_id }) =>
      itemIds.has(candidate_id),
    ),
  };
}

export function removeMockListItems(store: ProjectStore, itemIds: Set<string>) {
  store.listItems = store.listItems.filter((item) => !itemIds.has(item.id));
  store.candidateRecipients = store.candidateRecipients.filter(
    ({ candidate_id, person_id }) =>
      !itemIds.has(candidate_id) && !itemIds.has(person_id),
  );
  store.candidateVotes = store.candidateVotes.filter(
    ({ candidate_id }) => !itemIds.has(candidate_id),
  );
  store.photos = store.photos.filter((photo) => {
    if (!itemIds.has(photo.item_id)) return true;
    store.photoFiles.delete(photo.id);
    return false;
  });
}

function clearIneligibleRecipients(store: ProjectStore, projectId: string) {
  const lists = store.lists.filter((list) => list.project_id === projectId);
  for (const list of lists) {
    if (list.kind !== "candidates") continue;
    const source = projectQuantitySource(list, lists, store.listItems);
    const eligible = new Set(source?.people.map(({ id }) => id));
    store.candidateRecipients = store.candidateRecipients.filter(
      ({ list_id, person_id }) =>
        list_id !== list.id || eligible.has(person_id),
    );
  }
}

export function writeMockList(
  store: ProjectStore,
  command: ProjectListCommand,
  actor: string,
) {
  const { projectId, id } = command;
  const project = store.projects.find((row) => row.id === projectId);
  if (!project?.modules.includes("lists")) throw projectListNotFound();
  const listId = "listId" in command ? command.listId : id;
  const list = store.lists.find(
    (row) => row.project_id === projectId && row.id === listId,
  );
  if (listId && !list) throw projectListNotFound();

  switch (command.action) {
    case "save_list": {
      const { item } = command;
      if (list && list.kind !== item.kind) throw invalid();
      if (
        item.quantity_list_id &&
        !store.lists.some(
          (roster) =>
            roster.project_id === projectId &&
            roster.kind === "people" &&
            roster.id === item.quantity_list_id &&
            roster.tags.some((tag) => tag.key === item.quantity_tag_key),
        )
      )
        throw invalid();
      if (!list) {
        const sort_order =
          Math.max(
            -1,
            ...store.lists
              .filter((row) => row.project_id === projectId)
              .map((row) => row.sort_order),
          ) + 1;
        const newId = randomUUID();
        store.lists.push({
          ...item,
          id: newId,
          project_id: projectId,
          sort_order,
        });
        return newId;
      }
      const activeColumns = new Set(item.columns.map((column) => column.key));
      const activeTags = new Set(item.tags.map((tag) => tag.key));
      const rows = store.listItems
        .filter((row) => row.list_id === list.id)
        .map((row) => ({
          row,
          values: Object.fromEntries(
            Object.entries(row.values).filter(([key]) =>
              activeColumns.has(key),
            ),
          ),
        }));
      const blocked = rows
        .filter(({ values }) => !validProjectValues(item.columns, values))
        .map(({ row }) => `‘${row.title}’`);
      if (blocked.length)
        throw new ApiError(
          "project_columns_in_use",
          `기존 칸 값을 먼저 수정해 주세요. 해당 항목은 ${blocked.join(", ")}예요.`,
          400,
        );
      for (const { row, values } of rows) {
        row.values = values;
        row.tags = row.tags.filter((key) => activeTags.has(key));
        row.done_tags = row.done_tags.filter((key) => activeTags.has(key));
      }
      for (const row of store.lists) {
        if (
          row.quantity_list_id === list.id &&
          !activeTags.has(row.quantity_tag_key!)
        ) {
          row.quantity_list_id = null;
          row.quantity_tag_key = null;
        }
      }
      Object.assign(list, item);
      clearIneligibleRecipients(store, projectId);
      return list.id;
    }
    case "delete_list":
      store.lists = store.lists.filter((row) => row.id !== id);
      for (const row of store.lists) {
        if (row.quantity_list_id === id) {
          row.quantity_list_id = null;
          row.quantity_tag_key = null;
        }
      }
      removeMockListItems(
        store,
        new Set(
          store.listItems
            .filter((row) => row.list_id === id)
            .map((row) => row.id),
        ),
      );
      return id;
    case "disconnect_list_quantity":
      if (list?.kind !== "candidates") throw projectListNotFound();
      list.quantity_list_id = null;
      list.quantity_tag_key = null;
      clearIneligibleRecipients(store, projectId);
      return id;
  }

  if (!list) throw projectListNotFound();
  const current = store.listItems.find(
    (row) => row.list_id === list.id && row.id === id,
  );
  if (id && !current) throw projectListNotFound();
  switch (command.action) {
    case "save_list_item": {
      const { item } = command;
      const isPeople = list.kind === "people";
      if (
        !validProjectValues(list.columns, item.values) ||
        !item.tags.every((key) => list.tags.some((tag) => tag.key === key)) ||
        (isPeople
          ? item.status !== null || item.price !== null || item.links.length > 0
          : !item.status)
      )
        throw invalid();
      if (command.preserveStatus && isPeople) throw projectListNotFound();
      const status = command.preserveStatus
        ? (current?.status ?? "candidate")
        : item.status;
      if (current) {
        const done_tags = current.done_tags.filter((key) =>
          item.tags.includes(key),
        );
        Object.assign(current, { ...item, status, done_tags });
        if (isPeople) clearIneligibleRecipients(store, projectId);
        return current.id;
      }
      const sort_order =
        Math.max(
          -1,
          ...store.listItems
            .filter((row) => row.list_id === list.id)
            .map((row) => row.sort_order),
        ) + 1;
      const newId = randomUUID();
      store.listItems.push({
        ...item,
        status,
        id: newId,
        list_id: list.id,
        sort_order,
      });
      return newId;
    }
    case "set_candidate_recipient": {
      if (!current || list.kind !== "candidates") throw projectListNotFound();
      const source = projectQuantitySource(list, store.lists, store.listItems);
      if (!source?.people.some(({ id }) => id === command.personId))
        throw invalid();
      store.candidateRecipients = store.candidateRecipients.filter(
        (row) =>
          row.list_id !== list.id ||
          row.person_id !== command.personId ||
          (!command.assigned && row.candidate_id !== current.id),
      );
      if (command.assigned) {
        store.candidateRecipients.push({
          list_id: list.id,
          candidate_id: current.id,
          person_id: command.personId,
        });
      }
      return current.id;
    }
    case "set_candidate_vote": {
      if (!current || list.kind !== "candidates") throw projectListNotFound();
      store.candidateVotes = store.candidateVotes.filter(
        (row) => row.candidate_id !== current.id || row.user_id !== actor,
      );
      if (command.vote) {
        store.candidateVotes.push({
          candidate_id: current.id,
          user_id: actor,
          vote: command.vote,
        });
      }
      return current.id;
    }
    case "set_candidate_status":
      if (!current || list.kind !== "candidates") throw projectListNotFound();
      current.status = command.status;
      return current.id;
    case "delete_list_item":
      removeMockListItems(store, new Set([command.id]));
      return command.id;
    case "set_list_tag_done": {
      if (!current?.tags.includes(command.tagKey)) throw projectListNotFound();
      const tags = new Set(current.done_tags);
      if (command.done) tags.add(command.tagKey);
      else tags.delete(command.tagKey);
      current.done_tags = [...tags];
      return current.id;
    }
    case "delete_list_photo": {
      const { photoId } = command;
      if (
        !store.photos.some(
          (photo) => photo.item_id === id && photo.id === photoId,
        )
      )
        throw projectListNotFound();
      store.photos = store.photos.filter((photo) => photo.id !== photoId);
      store.photoFiles.delete(photoId);
      return photoId;
    }
  }
}

export function saveMockListPhoto(
  store: ProjectStore,
  projectId: string,
  listId: string,
  itemId: string,
  files: [Blob, Blob],
) {
  const { lists, listItems } = readMockLists(store, projectId);
  if (
    !lists.some((list) => list.id === listId && list.kind === "candidates") ||
    !listItems.some((item) => item.id === itemId && item.list_id === listId)
  )
    throw projectListNotFound();
  const photo: ProjectPhoto = { id: randomUUID(), item_id: itemId };
  store.photos.push(photo);
  store.photoFiles.set(photo.id, files);
  return photo.id;
}
