import { describe, expect, it } from "vitest";
import { cartInputSchema } from "./cart.schema";
const item = {
  name: "두부",
  quantity: 1,
  unit_id: null,
  category_id: null,
  memo: "",
  link_url: "",
  inventory_item_id: null,
};
describe("CART-01 CART-10 CART-12 입력 검증", () => {
  it("쇼핑몰 http와 https 주소만 받아요", () => {
    for (const link_url of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "file:///tmp/a",
      "HTTPS://example.com/a",
      "https://example.com/a b",
      "https://example.com/a\nb",
    ])
      expect(cartInputSchema.safeParse({ ...item, link_url }).success).toBe(
        false,
      );
    expect(
      cartInputSchema.safeParse({
        ...item,
        link_url: "https://example.com/item",
      }).success,
    ).toBe(true);
  });
  it("저장할 주소를 URL 형식으로 정규화해요", () => {
    expect(
      cartInputSchema.parse({ ...item, link_url: "https://EXAMPLE.com" })
        .link_url,
    ).toBe("https://example.com/");
  });
  it("양수가 아닌 수량과 빈 이름을 거부해요", () => {
    for (const quantity of [0, -1, NaN, Infinity])
      expect(cartInputSchema.safeParse({ ...item, quantity }).success).toBe(
        false,
      );
    expect(cartInputSchema.safeParse({ ...item, name: "  " }).success).toBe(
      false,
    );
  });
});
