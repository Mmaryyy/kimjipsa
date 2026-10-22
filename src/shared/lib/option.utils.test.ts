import { describe, expect, expectTypeOf, it } from "vitest";
import { getOptionLabel } from "./option.utils";

const options = [
  { value: "kakao", label: "카카오 계정" },
  { value: "google", label: "Google 계정" },
] as const;

describe("getOptionLabel", () => {
  it("값과 같은 옵션의 라벨을 돌려줘요", () => {
    expect(getOptionLabel("google", options)).toBe("Google 계정");
  });

  it("맞는 옵션이 없으면 안내 문구를 돌려줘요", () => {
    expect(getOptionLabel(undefined, options, "확인할 수 없어요")).toBe(
      "확인할 수 없어요",
    );
  });

  it("안내 문구도 없으면 값을 그대로 돌려줘요", () => {
    expect(getOptionLabel<string>("apple", options)).toBe("apple");
    expect(getOptionLabel(null, options)).toBeNull();
    expect(getOptionLabel(undefined, options)).toBeUndefined();
  });

  it("null 값을 가진 옵션도 찾아요", () => {
    expect(
      getOptionLabel(null, [
        { value: null, label: "없음" },
        { value: 10, label: "10분 전" },
      ]),
    ).toBe("없음");
  });

  it("안내 문구가 있으면 문자열 타입만 돌려줘요", () => {
    const numericOptions = [{ value: 10, label: "10분 전" }] as const;

    expectTypeOf(
      getOptionLabel(10, numericOptions, "없음"),
    ).toEqualTypeOf<string>();
    expectTypeOf(getOptionLabel(10, numericOptions)).toEqualTypeOf<
      string | 10 | null | undefined
    >();
  });

  it("옵션 목록에 없는 도메인의 값은 타입 오류예요", () => {
    // @ts-expect-error 로그인 옵션에 일정 공개 범위를 전달할 수 없어요.
    getOptionLabel("private", options);
  });
});
