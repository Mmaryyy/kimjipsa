export type Holiday = { date: string; name: string };
export type SpecialDay = Holiday & { kind: "solarTerm" | "sundry" };
export type CalendarDayInfo = Holiday & {
  kind: "holiday" | SpecialDay["kind"];
};
