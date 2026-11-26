import { describe, expect, it } from "vitest";
import { formatAmount, type AmountFormat } from "./amount.utils";

describe("금액 표시 방식", () => {
  it.each<[AmountFormat, string]>([
    ["won", "1,200,000원"],
    ["number", "1,200,000"],
    ["korean", "120만 원"],
    ["symbol", "₩1,200,000"],
  ])("%s 설정에 맞춰 표시한다", (format, expected) => {
    expect(formatAmount(1_200_000, format)).toBe(expected);
  });

  it("한글 단위에서도 금액의 나머지와 소수부를 표시한다", () => {
    expect(formatAmount(BigInt(123_000_000), "korean")).toBe("1억 2,300만 원");
    expect(formatAmount(123_000_001.5, "korean")).toBe("1억 2,300만 1.5원");
    expect(formatAmount(0, "korean")).toBe("0원");
    expect(formatAmount(-2_000, "symbol")).toBe("-₩2,000");
  });
});
