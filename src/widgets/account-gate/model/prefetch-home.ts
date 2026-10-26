import {
  inventoryQueryOptions,
  inventoryMetaQueryOptions,
} from "@/entities/inventory-item";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import {
  eventsQueryOptions,
  categoriesQueryOptions,
  dismissalsQueryOptions,
  kstNow,
  kstDate,
} from "@/entities/event";
import { homeSettingsQueryOptions } from "@/entities/user";
import { holidaysQueryOptions } from "@/entities/holiday";
import { familyQueryOptions } from "@/features/family";

export async function prefetchHome(
  client: QueryClient,
  search = typeof window === "undefined" ? "" : window.location.search,
) {
  const parsedDate = z.iso
    .date()
    .safeParse(new URLSearchParams(search).get("date"));
  const selected = parsedDate.success ? kstDate(parsedDate.data) : kstNow();
  // 기존 전체 일정 캐시에는 이번 주, 다가오는 일정, D-day가 함께 들어 있어요.
  // 월 보기 설정과 연말에 걸친 주도 첫 렌더에서 공휴일을 기다리지 않아요.
  const start = startOfWeek(startOfMonth(selected)).getFullYear();
  const end = endOfWeek(endOfMonth(selected)).getFullYear();
  await Promise.allSettled([
    client.prefetchQuery(inventoryQueryOptions),
    client.prefetchQuery(inventoryMetaQueryOptions),
    client.prefetchQuery(eventsQueryOptions),
    client.prefetchQuery(categoriesQueryOptions),
    client.prefetchQuery(homeSettingsQueryOptions),
    client.prefetchQuery(dismissalsQueryOptions),
    client.prefetchQuery(familyQueryOptions),
    ...Array.from({ length: end - start + 1 }, (_, index) =>
      client.prefetchQuery(holidaysQueryOptions(start + index)),
    ),
  ]);
}
