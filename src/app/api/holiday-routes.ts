import "server-only";
import { ApiError } from "@/shared/api";
import { handleRoute, mockContext } from "@/shared/server";
import { authenticatedClient } from "@/entities/user/index.server";
import {
  holidayYearSchema,
  listHolidays,
} from "@/entities/holiday/index.server";

export function holidaysGET(request: Request) {
  return handleRoute(request, async () => {
    const mock = await mockContext();
    if (mock) {
      if ((mock.values.get("account-stage") ?? mock.stage) === "login") {
        throw new ApiError("unauthorized", "로그인이 필요해요.", 401);
      }
    } else {
      await authenticatedClient();
    }
    const year = holidayYearSchema.parse(
      new URL(request.url).searchParams.get("year"),
    );
    return listHolidays(year);
  });
}
