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
    await page.goto("/chat");
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
