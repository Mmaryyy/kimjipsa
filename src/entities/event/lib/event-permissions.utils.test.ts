import { describe, expect, it } from "vitest";
import {
  filterEventForRequester,
  type EventRecord,
} from "./event-permissions.utils";
const event: EventRecord = {
  id: "event",
  owner_id: "owner",
  visibility: "private",
  start_date: "2026-10-16",
  end_date: "2026-10-16",
  start_time: "15:00:00",
  end_time: "16:00:00",
  is_all_day: false,
  event_details: {
    title: "CANARY_TITLE",
    place: "CANARY_PLACE",
    memo: "CANARY_MEMO",
    category_id: "CANARY_CATEGORY",
  },
};
describe("CAL-03~05 개인 일정 응답 필터", () => {
  it("SCN-CAL-2 배우자 응답에는 내용·카테고리가 없고 시간만 남아요", () => {
    const response = filterEventForRequester(event, "spouse");
    expect(response.details).toBeNull();
    expect(response.canEdit).toBe(false);
    expect(response.canChangeVisibility).toBe(false);
    expect(response.startDate).toBe(event.start_date);
    expect(JSON.stringify(response)).not.toContain("CANARY");
  });
  it("SCN-CAL-3 작성자는 개인 일정 내용을 보고 수정할 수 있어요", () => {
    const response = filterEventForRequester(event, "owner");
    expect(response.details?.title).toBe("CANARY_TITLE");
    expect(response.canEdit).toBe(true);
    expect(response.canChangeVisibility).toBe(true);
  });
  it("SCN-CAL-1 공유 일정은 배우자도 같은 내용을 보고 수정할 수 있어요", () => {
    const response = filterEventForRequester(
      { ...event, visibility: "shared" },
      "spouse",
    );
    expect(response.details?.title).toBe("CANARY_TITLE");
    expect(response.canEdit).toBe(true);
    expect(response.canChangeVisibility).toBe(false);
  });
});
