import { useQuery } from "@tanstack/react-query";
import type * as QueryModule from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { fetchCategories } from "../api/api";
import { categoryQueryKey, useEventCategories } from "./use-events";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof QueryModule>()),
  useQuery: vi.fn(),
}));

describe("CAL-08 ACC-13 r049-f1 카테고리 조회", () => {
  it(
    "주기 조회 없이 30초 동안 최신 상태를 유지하고 " +
      "마운트 시 실패한 조회를 재시도하지 않아요",
    () => {
      useEventCategories();
      expect(vi.mocked(useQuery).mock.lastCall?.[0]).toEqual({
        queryKey: categoryQueryKey,
        queryFn: fetchCategories,
        staleTime: 30_000,
        retryOnMount: false,
      });
    },
  );
});
