import { expect, test } from "@playwright/test";
const familyId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const messageId = "10000000-0000-4000-8000-000000000003";
for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`BOT-10/11 개인 전용 채팅과 요청 ${viewport.width}`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await context.addCookies([
      {
        name: "kimjipsa-mock-enabled",
        value: "1",
        url: testInfo.project.use.baseURL!,
      },
      {
        name: "kimjipsa-mock-session",
        value: "chat-capabilities-test",
        url: testInfo.project.use.baseURL!,
      },
    ]);
    const sends: Array<{ visibility: string; text: string }> = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let data: unknown = null;
      if (url.pathname === "/api/account")
        data = {
          userId,
          profile: { displayName: "테스트", termsVersion: "beta-2026-10-30" },
          membership: { familyId, role: "admin" },
        };
      else if (url.pathname === "/api/chat") {
        if (request.method() === "POST") {
          sends.push(request.postDataJSON());
          data = { id: messageId };
        } else {
          const visibility = url.searchParams.get("visibility");
          data = {
            familyId,
            sessionVersion: 1,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            name: "집사",
            workerOnline: true,
            nextBefore: null,
            runs: [],
            receipts: [],
            proposals: [],
            attachments: [],
            messages: [
              {
                id: messageId,
                sequence: 1,
                role: "assistant",
                text:
                  visibility === "private"
                    ? "개인 일정 내용"
                    : "가족 대화 내용",
                author: "김집사",
                attachment_ids: [],
                created_at: "2026-11-04T01:00:00Z",
                visibility,
                sources: [
                  { title: "검색 출처", url: "https://example.com/source" },
                ],
              },
            ],
          };
        }
      }
      await route.fulfill({ json: { ok: true, data } });
    });
    // No real account, model request or mutation reaches a service in this UI test.
    await page.route("https://**/*", (route) => route.abort());
    await page.goto("/");
    await page.getByRole("button", { name: "AI 집사 채팅 열기" }).click();
    await expect(
      page.getByRole("dialog", { name: "집사와 대화" }),
    ).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(
      page.getByText("마지막 메시지 후 1시간이 지나면 대화 기록이 삭제돼요."),
    ).toBeVisible();
    const input = page.getByRole("textbox", { name: "집사에게 보낼 메시지" });
    await expect(
      page.getByText("개인 일정 내용", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("가족 대화 내용", { exact: true })).toHaveCount(
      0,
    );
    await expect(input).toHaveValue("");
    const bounds = await input.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await expect(
      page.getByRole("link", { name: "[1] 검색 출처" }),
    ).toHaveAttribute("href", "https://example.com/source");
    await input.fill("개인 일정 조회해줘");
    await page.getByRole("button", { name: "보내기", exact: true }).click();
    await expect.poll(() => sends.length).toBe(1);
    expect(sends[0]).toMatchObject({
      visibility: "private",
      text: "개인 일정 조회해줘",
    });
    await expect(input).toBeEnabled();
    await expect(input).toHaveValue("");
    await page.screenshot({
      path: testInfo.outputPath(`private-chat-${viewport.width}.png`),
    });
  });
}

for (const width of [375, 1280]) {
  test(`BOT-01 시트 열기·Esc·최소화·뒤로가기 ${width}`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
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
    await page.goto("/");
    const launcher = page.getByRole("button", { name: "AI 집사 채팅 열기" });
    const dialog = page.getByRole("dialog", { name: "집사와 대화" });
    await launcher.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (let index = 0; index < 12; index++) await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    await expect(page.locator('[data-od-id="bot-fab"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    const input = dialog.getByRole("textbox", { name: "집사에게 보낼 메시지" });
    await input.fill("쓰던 글");
    await input.dispatchEvent("keydown", { key: "Escape", isComposing: true });
    await expect(input).toBeFocused();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue("쓰던 글");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(launcher).toBeFocused();
    await launcher.click();
    if (width < 768) {
      await page.goBack();
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(/\/$/);
      await launcher.click();
    } else {
      await page.mouse.click(300, 200);
      await expect(dialog).toHaveCount(0);
      await launcher.click();
    }
    await dialog.getByRole("button", { name: "최소화", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(launcher).toHaveCount(0);
    const botTab = page.getByRole("link", { name: "집사", exact: true });
    await botTab.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(botTab).toBeFocused();
    await page.reload();
    await expect(launcher).toHaveCount(0);
    await expect(botTab).toBeVisible();
  });
}

test("BOT-01 /chat 직접 진입은 홈 위 시트를 열고 닫아도 홈에 남아요", async ({
  page,
  context,
}, testInfo) => {
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
  await page.goto("/chat");
  const dialog = page.getByRole("dialog", { name: "집사와 대화" });
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
});
