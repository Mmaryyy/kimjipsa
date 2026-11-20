import type { ProjectReservation } from "../api/type";

export function reservationConflicts(rows: readonly ProjectReservation[]) {
  const active = rows.flatMap((row) => {
    const start = row.starts_on;
    if (!start || row.status === "cancelled") return [];
    return [{ row, start, end: row.ends_on ?? start }];
  });
  const conflicts = [];
  for (const [index, a] of active.entries()) {
    for (const b of active.slice(index + 1)) {
      if (a.row.project_id !== b.row.project_id || a.row.kind !== b.row.kind)
        continue;
      const start = a.start > b.start ? a.start : b.start;
      const end = a.end < b.end ? a.end : b.end;
      // A multi-day booking ends at checkout; a same-day booking occupies its date.
      const aEnd = a.end === a.start ? `${a.end}~` : a.end;
      const bEnd = b.end === b.start ? `${b.end}~` : b.end;
      const overlaps = a.start < bEnd && b.start < aEnd;
      if (overlaps) conflicts.push({ first: a.row, second: b.row, start, end });
    }
  }
  return conflicts;
}
