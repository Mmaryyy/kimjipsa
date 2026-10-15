import { expect, test } from "@playwright/test";

const title = "p1-5 앱 셸에 라이트·다크 토큰을 적용해요 (기능 SCN 연결 전)";

test(title, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const main = page.getByRole("main");
  await expect(
    page.getByRole("heading", { name: "오늘", level: 1 }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        return registration?.active?.scriptURL;
      }),
    )
    .toBe(new URL("/sw.js", page.url()).href);
  await expect(main).toHaveCSS("background-color", "rgb(246, 246, 248)");
  await expect(main).toHaveCSS("color", "rgb(29, 29, 31)");

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(main).toHaveCSS("background-color", "rgb(26, 26, 28)");

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await expect(main).toHaveCSS("background-color", "rgb(246, 246, 248)");
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(main).toHaveCSS("background-color", "rgb(26, 26, 28)");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

for (const width of [375, 1280]) {
  test(`P1 ${width}px 메뉴 표시 (기능 SCN 연결 전)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const bottom = page.getByRole("navigation", {
      name: "하단 메뉴",
      includeHidden: true,
    });
    const sidebar = page.getByRole("navigation", {
      name: "주 메뉴",
      includeHidden: true,
    });
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("complementary")).toHaveCount(0);
    if (width === 375) {
      await expect(bottom).toBeVisible();
      await expect(sidebar).toBeHidden();
    } else {
      await expect(sidebar).toBeVisible();
      await expect(bottom).toBeHidden();
      await expect(
        sidebar.getByRole("link", { name: "김집사", exact: true }),
      ).toBeVisible();
    }
  });
}
