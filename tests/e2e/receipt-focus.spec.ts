import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Chat } from "@/entities/chat-message";

test("INV-17 SCN-BOT-6 영수증 입력과 셀렉트의 포커스 선이 컨트롤 안에 보여요", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
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
  await page.route(/\/api\/chat\?/, async (route) => {
    const response = await route.fetch();
    const { data: chat }: { data: Chat } = await response.json();
    await route.fulfill({
      json: {
        ok: true,
        data: {
          ...chat,
          receipts: [
            {
              id: randomUUID(),
              run_id: chat.runs[0].id,
              kind: "receipt",
              status: "draft",
              version: 1,
              expires_at: new Date(Date.now() + 3600000).toISOString(),
              items: [
                {
                  name: "우유",
                  original_name: "우유",
                  quantity: 2,
                  selected: true,
                  unit_id: null,
                  inventory_item_id: null,
                  category_id: null,
                  location_id: null,
                  expires_on: null,
                  reason: "",
                },
              ],
            },
          ],
        } satisfies Chat,
      },
    });
  });
  await page.goto("/chat");
  const card = page.getByRole("region", { name: "영수증 확인" });
  await card.getByRole("button", { name: /우유 · 2/ }).click();
  const name = card.getByRole("textbox", { name: "품목 1 이름" });
  const category = card.getByRole("combobox", { name: "품목 1 카테고리" });
  await expect(name).toBeVisible();
  await page.keyboard.press("Tab");
  for (const control of [name, category]) {
    await control.focus();
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS("outline-style", "solid");
    await expect(control).toHaveCSS("outline-width", "2px");
    await expect(control).toHaveCSS("outline-offset", "-2px");
  }
});
