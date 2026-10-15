import { expect, test } from "@playwright/test";
import { themeModes, themeModeStorageKey } from "../../src/shared/config";

for (const { value, label } of themeModes) {
  test(`P1 화면 모드 ${label} 선택을 다시 열어도 유지해요 (기능 SCN 연결 전)`, async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: "설정", level: 1 }),
    ).toBeVisible();
    const group = page.getByRole("radiogroup", { name: "화면 모드" });
    const button = group.getByRole("radio", { name: label, exact: true });
    const otherMode = themeModes.find((mode) => mode.value !== value)!;
    await group
      .getByRole("radio", { name: otherMode.label, exact: true })
      .click();
    await button.click();
    await expect(button).toHaveAttribute("aria-checked", "true");
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), themeModeStorageKey),
      )
      .toBe(value);
    await page.reload();
    await expect(button).toHaveAttribute("aria-checked", "true");
    for (const other of themeModes.filter((mode) => mode.value !== value)) {
      await expect(
        group.getByRole("radio", { name: other.label, exact: true }),
      ).toHaveAttribute("aria-checked", "false");
    }
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), themeModeStorageKey),
      )
      .toBe(value);
  });
}
