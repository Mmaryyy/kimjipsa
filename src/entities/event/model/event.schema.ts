import { z } from "zod";
import { eventCategoryColors, eventVisibility } from "./event.constants";
const date = z.iso.date({ error: "날짜를 확인해 주세요." });
const time = z
  .string({ error: "시각을 확인해 주세요." })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시각을 확인해 주세요.")
  .nullable();
export const eventSchema = z
  .object({
    kind: z.enum(["event", "dday"]).default("event"),
    ddayStyle: z.enum(["normal", "celebrate"]).default("normal"),
    celebrateMessage: z.string().trim().default(""),
    title: z
      .string({ error: "제목을 입력해 주세요." })
      .trim()
      .min(1, "제목을 입력해 주세요."),
    place: z.string({ error: "장소를 확인해 주세요." }),
    memo: z.string({ error: "메모를 확인해 주세요." }),
    categoryId: z.uuid("카테고리를 선택해 주세요."),
    visibility: z.enum(Object.keys(eventVisibility) as ["shared", "private"], {
      error: "공개 범위를 선택해 주세요.",
    }),
    startDate: date,
    endDate: date,
    startTime: time,
    endTime: time,
    isAllDay: z.boolean({ error: "종일 여부를 확인해 주세요." }),
  })
  .superRefine((event, context) => {
    if (
      event.kind === "dday" &&
      (event.startDate !== event.endDate || !event.isAllDay)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "D-day는 기준 날짜 하루를 종일로 등록해 주세요.",
      });
    }
    if (
      event.kind === "event" &&
      (event.ddayStyle !== "normal" || event.celebrateMessage !== "")
    ) {
      context.addIssue({
        code: "custom",
        path: ["ddayStyle"],
        message: "축하 설정은 D-day에서만 사용할 수 있어요.",
      });
    }
    if (
      event.endDate < event.startDate ||
      (event.endDate === event.startDate &&
        event.startTime !== null &&
        event.endTime !== null &&
        event.endTime <= event.startTime)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "종료는 시작보다 뒤여야 해요.",
      });
    }
    if (
      event.isAllDay &&
      (event.startTime !== null || event.endTime !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "종일 일정은 시각을 비워 주세요.",
      });
    }
  });
export const eventCategorySchema = z.object({
  name: z
    .string({ error: "카테고리 이름을 입력해 주세요." })
    .trim()
    .min(1, "카테고리 이름을 입력해 주세요."),
  color: z.enum(
    Object.keys(eventCategoryColors) as [
      keyof typeof eventCategoryColors,
      ...(keyof typeof eventCategoryColors)[],
    ],
    { error: "카테고리 색을 선택해 주세요." },
  ),
  sortOrder: z
    .number({ error: "표시 순서를 확인해 주세요." })
    .int("표시 순서는 정수로 입력해 주세요.")
    .min(0, "표시 순서는 0 이상으로 입력해 주세요."),
});
