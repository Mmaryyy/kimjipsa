import { describe, expect, it } from "vitest";
import { milestoneInput, projectCommand } from "./project.schema";
import {
  projectProgress,
  projectTimeline,
  upcomingTasks,
} from "./progress.utils";

describe("PRJ-01~04 · SCN-PRJ-1", () => {
  it("완료한 할 일만 진행률에 반영하고 빈 영역은 0%로 표시한다", () => {
    expect(projectProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(
      projectProgress([
        { status: "done" },
        { status: "on_hold" },
        { status: "todo" },
      ]),
    ).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it("타임라인을 날짜순으로 정렬하고 기간의 마지막 날도 지금으로 표시한다", () => {
    const tentative = { starts_on: null, ends_on: null, is_tentative: true };
    const dated = {
      starts_on: "2026-11-18",
      ends_on: "2026-11-20",
      is_tentative: false,
    };
    const past = { ...dated, starts_on: "2026-11-17", ends_on: null };
    const upcoming = { ...dated, starts_on: "2026-11-21", ends_on: null };
    const timeline = projectTimeline(
      [upcoming, tentative, dated, past],
      "2026-11-20",
    );
    expect(timeline).toEqual([
      { milestone: past, status: "past" },
      { milestone: dated, status: "current" },
      { milestone: upcoming, status: "upcoming" },
      { milestone: tentative, status: "tentative" },
    ]);
    expect(
      milestoneInput.safeParse({
        ...tentative,
        title: "상견례",
        area_id: null,
        memo: "",
      }).success,
    ).toBe(true);
    expect(
      milestoneInput.safeParse({
        ...dated,
        is_tentative: true,
        title: "상견례",
        area_id: null,
        memo: "",
      }).success,
    ).toBe(false);
  });

  it("오늘부터의 미완료 마감만 날짜순으로 표시한다", () => {
    expect(
      upcomingTasks(
        [
          { status: "todo", due_on: "2026-11-23" },
          { status: "done", due_on: "2026-11-20" },
          { status: "todo", due_on: "2026-11-19" },
          { status: "on_hold", due_on: "2026-11-20" },
          { status: "todo", due_on: null },
        ],
        "2026-11-20",
      ).map((task) => task.status),
    ).toEqual(["on_hold", "todo"]);
  });

  it("구성원 담당에는 구성원 ID가 필요하다", () => {
    expect(
      projectCommand.safeParse({
        action: "save_task",
        projectId: "00000000-0000-4000-8000-000000000001",
        item: {
          title: "휴가 확인",
          area_id: null,
          assignee_kind: "member",
          assignee_id: null,
          status: "todo",
          starts_on: null,
          due_on: null,
          depends_note: "",
          memo: "",
        },
      }).success,
    ).toBe(false);
  });
});
