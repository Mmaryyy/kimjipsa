import { expect, test, type Page, type TestInfo } from "@playwright/test";

const familyId = "20000000-0000-4000-8000-000000000001";
const userId = "20000000-0000-4000-8000-000000000002";
const messageId = (sequence: number) =>
  `30000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;

async function prepareChat(page: Page, testInfo: TestInfo) {
  await page.context().addCookies(
    ["kimjipsa-mock-enabled", "kimjipsa-mock-session"].map((name) => ({
      name,
      value: name === "kimjipsa-mock-enabled" ? "1" : "chat-pagination-test",
      url: testInfo.project.use.baseURL!,
    })),
  );
  const requests: Array<{ before: number | null; visibility: string }> = [];
  let count = 121;
  let sessionVersion = 1;
  let failOlder = false;
  let releaseOlder: (() => void) | undefined;
  let olderGate: Promise<void> | undefined;
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
        count++;
        data = { id: messageId(count) };
      } else {
        const visibility = url.searchParams.get("visibility") ?? "shared";
        const before = url.searchParams.has("before")
          ? Number(url.searchParams.get("before"))
          : null;
        requests.push({ before, visibility });
        if (before !== null) {
          await olderGate;
          if (failOlder) {
            await route.fulfill({
              status: 503,
              json: {
                ok: false,
                error: { code: "unavailable", message: "일시적인 오류" },
              },
            });
            return;
          }
        }
        const end = Math.min(count, before === null ? count : before - 1);
        const start = Math.max(1, end - 49);
        data = {
          familyId,
          sessionVersion,
          expiresAt: count
            ? new Date(Date.now() + 3600000).toISOString()
            : null,
          name: "집사",
          workerOnline: true,
          nextBefore: start > 1 ? start : null,
          runs: [],
          receipts: [],
          proposals: [],
          attachments: [],
          messages: Array.from({ length: end - start + 1 }, (_, index) => {
            const sequence = start + index;
            return {
              id: messageId(sequence),
              sequence,
              role: "assistant",
              text: `${visibility === "private" ? "개인" : "공용"} 대화 ${sequence}`,
              author: "김집사",
              attachment_ids: [],
              created_at: "2026-11-04T01:00:00Z",
              visibility,
              sources: [],
            };
          }),
        };
      }
    }
    await route.fulfill({ json: { ok: true, data } });
  });
  await page.route("https://**/*", (route) => route.abort());
  return {
    requests,
    expire() {
      count = 0;
      sessionVersion++;
    },
    holdOlder() {
      olderGate = new Promise<void>((resolve) => {
        releaseOlder = resolve;
      });
    },
    releaseOlder() {
      releaseOlder?.();
      olderGate = undefined;
    },
    failOlder(value: boolean) {
      failOlder = value;
    },
  };
}

for (const width of [360, 1280]) {
  test(`BOT-01/11 최근 대화와 위쪽 추가 로딩·읽던 위치 유지 ${width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    const chat = await prepareChat(page, testInfo);
    chat.holdOlder();
    await page.goto("/");
    await page.getByRole("button", { name: "AI 집사 채팅 열기" }).click();
    await expect(
      page.getByRole("dialog", { name: "집사와 대화" }),
    ).toBeVisible();
    const viewport = page.getByLabel("대화 내역", { exact: true });
    const messages = page
      .getByRole("log")
      .locator(":scope > li[data-message-id]");
    await expect(messages).toHaveCount(50);
    await expect(
      page.getByText("개인 대화 121", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("개인 대화 1", { exact: true })).toHaveCount(0);
    expect(chat.requests.every((request) => request.before === null)).toBe(
      true,
    );
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect
      .poll(
        () => chat.requests.filter((request) => request.before === 72).length,
      )
      .toBe(1);
    const anchor = page.getByText("개인 대화 72", { exact: true });
    const before = (await anchor.boundingBox())!.y;
    chat.releaseOlder();
    await expect(messages).toHaveCount(100);
    await expect
      .poll(async () => Math.abs((await anchor.boundingBox())!.y - before))
      .toBeLessThan(2);
    await expect(page.getByText("개인 대화 22", { exact: true })).toHaveCount(
      1,
    );
    await expect(page.getByText("개인 대화 1", { exact: true })).toHaveCount(0);

    // Sending triggers the same query invalidation as a live update; keep the reader's position.
    await page
      .getByRole("textbox", { name: "집사에게 보낼 메시지" })
      .fill("새 요청");
    await page.getByRole("button", { name: "보내기", exact: true }).click();
    await expect(page.getByText("개인 대화 122", { exact: true })).toHaveCount(
      1,
    );
    await expect
      .poll(async () => Math.abs((await anchor.boundingBox())!.y - before))
      .toBeLessThan(2);
    await page.getByRole("button", { name: "최근 대화 보기" }).click();
    await expect(
      page.getByText("개인 대화 122", { exact: true }),
    ).toBeInViewport();

    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(messages).toHaveCount(122);
    await expect(
      page.getByRole("button", { name: "이전 대화 불러오기" }),
    ).toHaveCount(0);
    const ids = await messages.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-message-id")),
    );
    expect(new Set(ids).size).toBe(122);

    expect(
      chat.requests.every((request) => request.visibility === "private"),
    ).toBe(true);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`pagination-${width}.png`),
    });
  });
}

test("BOT-01 이전 대화 조회 실패 시 현재 대화 유지·재시도", async ({
  page,
}, testInfo) => {
  const chat = await prepareChat(page, testInfo);
  chat.failOlder(true);
  await page.goto("/");
  await page.getByRole("button", { name: "AI 집사 채팅 열기" }).click();
  await expect(page.getByRole("dialog", { name: "집사와 대화" })).toBeVisible();
  const messages = page
    .getByRole("log")
    .locator(":scope > li[data-message-id]");
  await expect(messages).toHaveCount(50);
  await page.getByLabel("대화 내역", { exact: true }).evaluate((element) => {
    element.scrollTop = 0;
  });
  const error = page
    .getByRole("alert")
    .filter({ hasText: "이전 대화를 불러오지 못했어요" });
  await expect(error).toBeVisible();
  await expect(messages).toHaveCount(50);
  await expect(
    page.getByRole("textbox", { name: "집사에게 보낼 메시지" }),
  ).toBeEnabled();
  chat.failOlder(false);
  await page.getByRole("button", { name: "이전 대화 불러오기" }).click();
  await expect(messages).toHaveCount(100);
  await expect(error).toHaveCount(0);
});

test("BOT-11/14 만료 후 다시 열면 이전 페이지와 초안을 표시하지 않아요", async ({
  page,
}, testInfo) => {
  const chat = await prepareChat(page, testInfo);
  await page.goto("/");
  await page.getByRole("button", { name: "AI 집사 채팅 열기" }).click();
  await expect(page.getByRole("dialog", { name: "집사와 대화" })).toBeVisible();
  await expect(
    page.getByRole("log").locator(":scope > li[data-message-id]"),
  ).toHaveCount(50);
  await page
    .getByRole("textbox", { name: "집사에게 보낼 메시지" })
    .fill("오래된 초안");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "집사와 대화" })).toHaveCount(
    0,
  );
  chat.expire();
  await page.getByRole("button", { name: "AI 집사 채팅 열기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/안녕하세요, 테스트님/)).toBeVisible();
  await expect(page.getByText(/^개인 대화 /)).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "집사에게 보낼 메시지" }),
  ).toHaveValue("");
});

test("BOT-11/14 이전 페이지 요청 중 만료되면 과거 대화를 합치지 않아요", async ({
  page,
}, testInfo) => {
  const chat = await prepareChat(page, testInfo);
  chat.holdOlder();
  await page.goto("/");
  await page.getByRole("button", { name: "AI 집사 채팅 열기" }).click();
  await expect(page.getByRole("dialog", { name: "집사와 대화" })).toBeVisible();
  await expect(
    page.getByRole("log").locator(":scope > li[data-message-id]"),
  ).toHaveCount(50);
  await page.getByLabel("대화 내역", { exact: true }).evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect
    .poll(() => chat.requests.some((request) => request.before === 72))
    .toBe(true);
  chat.expire();
  chat.releaseOlder();
  await expect(page.getByText(/안녕하세요, 테스트님/)).toBeVisible();
  await expect(page.getByText(/^개인 대화 /)).toHaveCount(0);
});
