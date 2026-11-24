import { expect, test } from "@playwright/test";

test("INV-17 BOT-07 SCN-BOT-6 최근 대화 보기 버튼이 영수증 카드 동작을 가리지 않아요", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await context.addCookies([
    {
      name: "kimjipsa-mock-enabled",
      value: "1",
      url: testInfo.project.use.baseURL!,
    },
    {
      name: "kimjipsa-mock-stage",
      value: "ready",
      url: testInfo.project.use.baseURL!,
    },
  ]);
  await page.goto("/inventory");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await page.getByRole("button", { name: "영수증 등록" }).click();

  const viewport = page.getByLabel("대화 내역", { exact: true });
  const receipt = page.getByRole("region", { name: "영수증 확인" });
  const cancel = receipt.getByRole("button", { name: "취소하기" });
  const apply = receipt.getByRole("button", { name: "재고에 반영하기" });
  const latest = page.getByRole("button", { name: "최근 대화 보기" });
  await expect(apply).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });

  await viewport.evaluate((element) => {
    element.scrollTop -= 160;
  });
  await expect(latest).toBeVisible();

  await expect
    .poll(async () => {
      const list = (await viewport.boundingBox())!;
      const button = (await latest.boundingBox())!;
      return button.y - (list.y + list.height);
    })
    .toBeGreaterThanOrEqual(0);
  await latest.click();
  await expect(latest).toBeHidden();
  await expect(apply).toBeInViewport({ ratio: 1 });
  await expect(cancel).toBeInViewport({ ratio: 1 });
});
