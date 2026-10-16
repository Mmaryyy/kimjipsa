import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const timeZone = "Asia/Seoul";

export function formatDateTime(value: string) {
  return format(new Date(value), "yyyy. M. d. a h:mm", {
    locale: ko,
    in: tz(timeZone),
  });
}
