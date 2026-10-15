import { expect, test } from "@playwright/test";

const title = "p0-5 빈 화면에 라이트·다크 토큰을 적용해요 (기능 SCN 연결 전)";

test(title, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");

  const main = page.getByRole("main");
  await expect(
    page.getByRole("heading", { name: "김집사", level: 1 }),
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
