import { useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { fetchHomeSettings } from "../api/home-settings";
import { useHomeSettings } from "./use-home-settings";

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));

describe("ACC-12 r049-f1 홈 설정 조회", () => {
  it("주기 조회 없이 마운트와 포커스 갱신은 기본 설정을 따라요", () => {
    useHomeSettings();
    expect(vi.mocked(useQuery).mock.lastCall?.[0]).toEqual({
      queryKey: ["home-settings"],
      queryFn: fetchHomeSettings,
    });
  });
});
