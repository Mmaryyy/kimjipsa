import { describe, expect, it } from "vitest";
import type { ProjectListDefinition, ProjectListItem } from "../api/type";
import { projectListCommand, validProjectValues } from "./project-list.schema";
import {
  projectCandidateEstimate,
  projectQuantitySource,
  projectTagCounts,
} from "./project-list.utils";

const tag = { key: "aee9a43b-8371-40b2-80b9-d1d488d078ec", label: "답례품" }; // gitleaks:allow test UUID
const column = {
  key: "aee9a43b-8371-40b2-80b9-d1d488d078eb", // gitleaks:allow test UUID
  label: "지역",
  type: "select",
  options: ["광주", "안산"],
} as const;
const roster: ProjectListDefinition = {
  project_id: "131fd2a7-eed1-4e6e-9e04-79aa72a54da2",
  id: "32069ab8-8c8b-40be-96d2-48dddcde45b0",
  name: "가족 명단",
  kind: "people",
  columns: [],
  tags: [tag],
  quantity_list_id: null,
  quantity_tag_key: null,
  sort_order: 0,
};
const candidate: ProjectListDefinition = {
  ...roster,
  id: "41407a0b-4d04-4b5e-8ea1-aae8dd5c01ad",
  kind: "candidates",
  tags: [],
  quantity_list_id: roster.id,
  quantity_tag_key: tag.key,
};
const other = { ...roster, id: "e8c033a8-861d-4138-ba50-33405ee40aae" };
const person: ProjectListItem = {
  id: "6cd94f54-274d-4b27-8efd-b2e4fe21751a",
  list_id: roster.id,
  title: "사람",
  tags: [tag.key],
  done_tags: [tag.key],
  status: null,
  price: null,
  links: [],
  values: {},
  memo: "",
  sort_order: 0,
};

describe("PRJ-06·07 / SCN-PRJ-3", () => {
  it("지정 명단의 태그 인원만 예상 총액에 반영한다", () => {
    const items = [
      person,
      { ...person, done_tags: [] },
      { ...person, list_id: other.id },
    ];
    const source = projectQuantitySource(candidate, [roster, other], items);
    expect(source).toEqual({ roster: "가족 명단", tag: "답례품", count: 2 });
    expect(projectCandidateEstimate(12000, source?.count ?? null)).toBe(24000);
    expect(projectTagCounts(items.slice(0, 2), tag.key)).toEqual({
      total: 2,
      done: 1,
    });
  });

  it("빠진 명단과 태그를 다른 명단에서 찾지 않고 0과 미정을 구분한다", () => {
    expect(projectQuantitySource(candidate, [other], [person])).toBeNull();
    expect(
      projectQuantitySource(candidate, [{ ...roster, tags: [] }], []),
    ).toBeNull();
    expect(projectCandidateEstimate(12000, null)).toBeNull();
    expect(projectCandidateEstimate(null, 0)).toBeNull();
    expect(projectCandidateEstimate(0, 2)).toBe(0);
  });

  it("선택 옵션과 정의된 칸만 허용하고 불완전한 수량 연결을 거부한다", () => {
    const columns = [{ ...column, options: [...column.options] }];
    expect(validProjectValues(columns, { [column.key]: "광주" })).toBe(true);
    expect(validProjectValues(columns, { [column.key]: "포항" })).toBe(false);
    expect(validProjectValues(columns, { other: "광주" })).toBe(false);
    expect(
      projectListCommand.safeParse({
        action: "save_list",
        projectId: roster.project_id,
        item: { ...candidate, quantity_tag_key: null },
      }).success,
    ).toBe(false);
  });
});
