import { expect, it } from "vitest";
import { reservationInput } from "./project.schema";
import { reservationConflicts } from "./reservation.utils";
import type { ProjectReservation } from "../api/type";

const hotel: ProjectReservation = {
  id: "hotel",
  project_id: "project",
  area_id: null,
  title: "파리 작은 호텔",
  kind: "lodging",
  status: "booked",
  starts_on: "2027-04-28",
  ends_on: "2027-05-02",
  reference_no: "",
  links: [],
  cancel_deadline: null,
  payment_deadline: null,
  total_amount: 800000,
  paid_amount: 200000,
  memo: "",
  event_id: null,
};

it("PRJ-08 · SCN-PRJ-2 같은 프로젝트의 같은 종류인 유효한 예약만 비교한다", () => {
  const overlap = {
    ...hotel,
    id: "overlap",
    starts_on: "2027-04-30",
    ends_on: null,
  };
  const conflicts = reservationConflicts([
    hotel,
    overlap,
    { ...overlap, id: "cancelled", status: "cancelled" },
    { ...overlap, id: "another-project", project_id: "other" },
    { ...overlap, id: "other-kind", kind: "transport" },
    { ...overlap, id: "checkout", starts_on: hotel.ends_on },
  ]);
  expect(
    conflicts.map(({ first, second, start }) => [first.id, second.id, start]),
  ).toEqual([["hotel", "overlap", "2027-04-30"]]);
});

it("PRJ-08 결제액은 총액 이하이고 링크는 http(s)여야 한다", () => {
  expect(
    reservationInput.safeParse({ ...hotel, paid_amount: hotel.total_amount })
      .success,
  ).toBe(true);
  expect(
    reservationInput.safeParse({ ...hotel, paid_amount: 800001 }).success,
  ).toBe(false);
  expect(
    reservationInput.safeParse({ ...hotel, total_amount: null }).success,
  ).toBe(false);
  expect(
    reservationInput.safeParse({ ...hotel, links: ["javascript:alert(1)"] })
      .success,
  ).toBe(false);
});
