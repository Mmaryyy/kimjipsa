import { useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { fetchCategories } from "../api/api";
import { categoryQueryKey, useEventCategories } from "./use-events";

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));

describe("CAL-08 ACC-13 r049-f1 카테고리 조회", () => {
  it("주기 조회 없이 마운트와 포커스 갱신은 기본 설정을 따라요", () => {
    useEventCategories();
    expect(vi.mocked(useQuery).mock.lastCall?.[0]).toEqual({
      queryKey: categoryQueryKey,
      queryFn: fetchCategories,
    });
  });
});
