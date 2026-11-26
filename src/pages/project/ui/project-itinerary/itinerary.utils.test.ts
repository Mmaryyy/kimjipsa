import { describe, expect, it } from "vitest";
import { itineraryTimeline } from "./itinerary.utils";

describe("PRJ-09 일정표 타임라인", () => {
  it("SCN-PRJ-2 일정이 없는 날과 이어지는 날을 포함하고 기간 내 활성 예약만 보여 준다", () => {
    const item = {
      id: "arrival",
      project_id: "trip",
      title: "파리 도착",
      starts_on: "2027-04-28",
      ends_on: null,
      place: "",
      memo: "",
      links: [],
      event_id: null,
    };
    const stay = {
      id: "stay",
      project_id: "trip",
      area_id: null,
      title: "파리 숙소",
      kind: "lodging",
      status: "booked",
      starts_on: "2027-04-30",
      ends_on: "2027-05-06",
      cancel_deadline: null,
      payment_deadline: null,
      reference_no: "",
      total_amount: null,
      paid_amount: null,
      memo: "",
      links: [],
      event_id: null,
    } as const;
    const { days, reservationCount } = itineraryTimeline({
      itinerary: [
        {
          ...item,
          id: "tour",
          title: "바티칸 투어",
          starts_on: "2027-05-01",
          ends_on: "2027-05-02",
        },
        item,
      ],
      reservations: [
        { ...stay, links: [] },
        { ...stay, id: "cancelled", status: "cancelled", links: [] },
        { ...stay, id: "later", starts_on: "2027-05-03", links: [] },
      ],
    });

    expect(days.map(({ date }) => date)).toEqual([
      "2027-04-28",
      "2027-04-29",
      "2027-04-30",
      "2027-05-01",
      "2027-05-02",
    ]);
    expect(reservationCount).toBe(1);
    expect(days[1]).toMatchObject({ empty: true, continued: undefined });
    expect(days[2]).toMatchObject({ empty: false, bookings: [{ id: "stay" }] });
    expect(days[4]).toMatchObject({ empty: true, continued: { id: "tour" } });
  });
});
