import { useState } from "react";
import { readFileSync } from "node:fs";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useInventory,
  useInventoryActions,
  type InventoryItem,
  type InventoryMeta,
} from "@/entities/inventory-item";
const inventoryMeta: unknown = JSON.parse(
  readFileSync("mocks/inventory-defaults.json", "utf8"),
);
const inventoryItems: unknown = JSON.parse(
  readFileSync("mocks/inventory-items.json", "utf8"),
);
import InventoryItemRow from "./ItemRow";
import InventoryPage from ".";

const navigation = vi.hoisted(() => ({
  search: new URLSearchParams(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.search,
  useRouter: () => ({ replace: navigation.replace }),
}));

const milk = (inventoryItems as InventoryItem[])[0]!;
const InventoryRowExample = () => {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const { data = [] } = useInventory();
  const actions = useInventoryActions();
  return (
    <ul>
      {data.map((item) => (
        <InventoryItemRow
          key={item.id}
          item={item}
          meta={inventoryMeta as InventoryMeta}
          controlOpen={expandedItemId === item.id}
          onControlOpenChange={(open) =>
            setExpandedItemId(open ? item.id : null)
          }
          pending={actions.pendingIds.includes(item.id)}
          groupBy="locations"
          onOpen={vi.fn()}
          onStatus={vi.fn()}
          onAdjust={(delta) => {
            void actions
              .onChange({ action: "adjust", id: item.id, delta })
              .catch(() => {});
          }}
        />
      ))}
    </ul>
  );
};
afterEach(() => vi.unstubAllGlobals());

describe("INV-15 SCN-INV-2 재고 행 직접 입력", () => {
  it("직접 입력도 기존 조정 요청으로 즉시 반영하고 실패하면 되돌려요", async () => {
    let fail!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      fail = resolve;
    });
    const fetch = vi.fn((_url: string, options?: RequestInit) => {
      if (options?.method === "POST") return response;
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: [milk] })),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["inventory"], [milk]);
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <InventoryRowExample />
      </QueryClientProvider>,
    );
    const quantity = () =>
      screen.getByRole("button", { name: "우유 수량 직접 입력" });
    fireEvent.click(
      screen.getByRole("button", { name: /우유 수량 .*눌러서 바꾸기/ }),
    );
    fireEvent.click(quantity());
    const input = screen.getByRole("textbox", { name: "우유 수량" });
    fireEvent.change(input, { target: { value: "3.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(quantity()).toHaveTextContent("3.5"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      action: "adjust",
      id: milk.id,
      delta: 3.5 - milk.quantity,
    });
    await act(async () => {
      fail(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "failed", message: "저장 실패" },
          }),
          { status: 500 },
        ),
      );
    });
    await waitFor(() =>
      expect(quantity()).toHaveTextContent(String(milk.quantity)),
    );
    expect(
      client.getQueryData<InventoryItem[]>(["inventory"])![0]!.quantity,
    ).toBe(milk.quantity);
    unmount();
    client.clear();
  });
});

describe("INV-03 INV-05 INV-08 SCN-INV-2 탭별 재고 요약", () => {
  it.each(["locations", "categories"] as const)(
    "%s 탭을 바꾸면 요약과 목록이 함께 바뀌고 검색은 요약에 적용하지 않아요",
    (groupBy) => {
      const meta = inventoryMeta as InventoryMeta;
      const entries = meta[groupBy];
      const first = entries.find(
        (entry) =>
          entry.id ===
          (groupBy === "locations" ? milk.location_id : milk.category_id),
      )!;
      const second = entries.find((entry) => entry.id !== first.id)!;
      const empty = entries.find(
        (entry) => entry.id !== first.id && entry.id !== second.id,
      )!;
      const secondGroup = {
        location_id: groupBy === "locations" ? second.id : milk.location_id,
        category_id: groupBy === "categories" ? second.id : milk.category_id,
      };
      const items: InventoryItem[] = [
        { ...milk, expires_on: "2000-01-01" },
        { ...milk, ...secondGroup, id: "none", name: "빈 품목", quantity: 0 },
        {
          ...milk,
          ...secondGroup,
          id: "low",
          name: "다른 품목",
          expires_on: "2000-01-01",
        },
      ];
      navigation.search = new URLSearchParams({ by: groupBy });
      navigation.replace.mockReset();
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      client.setQueryData(["inventory"], items);
      client.setQueryData(["inventory-meta"], meta);
      const page = (
        <QueryClientProvider client={client}>
          <InventoryPage />
        </QueryClientProvider>
      );
      const { container, rerender, unmount } = render(page);
      const summary = within(
        container.querySelector<HTMLElement>('[data-od-id="inv-summary"]')!,
      );
      const expectCounts = (none: number, low: number, expiring: number) => {
        expect(summary.getByText(`없음 ${none}`)).toBeInTheDocument();
        expect(summary.getByText(`부족 ${low}`)).toBeInTheDocument();
        expect(summary.getByText(`임박 ${expiring}`)).toBeInTheDocument();
      };
      const selectTab = (label: string) => {
        fireEvent.click(screen.getByRole("radio", { name: label }));
        const [url] = navigation.replace.mock.lastCall!;
        navigation.search = new URLSearchParams(url.split("?")[1]);
        rerender(
          <QueryClientProvider client={client}>
            <InventoryPage />
          </QueryClientProvider>,
        );
      };
      expectCounts(1, 2, 2);
      selectTab(first.name);
      expectCounts(0, 1, 1);
      expect(screen.queryByText("다른 품목")).not.toBeInTheDocument();
      selectTab(second.name);
      expectCounts(1, 1, 1);
      expect(screen.queryByText("우유")).not.toBeInTheDocument();
      expect(screen.getByText("다른 품목")).toBeInTheDocument();
      fireEvent.change(screen.getByRole("searchbox", { name: "품목 검색" }), {
        target: { value: "검색 결과 없음" },
      });
      expectCounts(1, 1, 1);
      expect(screen.queryByText("다른 품목")).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole("searchbox", { name: "품목 검색" }), {
        target: { value: "" },
      });
      expect(screen.getByText("다른 품목")).toBeInTheDocument();
      selectTab(empty.name);
      expectCounts(0, 0, 0);
      selectTab("전체");
      expectCounts(1, 2, 2);
      unmount();
      client.clear();
    },
  );
});

describe("INV-01 INV-06 INV-08 SCN-INV-1 재고 추가와 목록 관리", () => {
  it.each([
    { label: "품목 목록", items: [milk], query: "" },
    { label: "빈 목록", items: [], query: "" },
    { label: "검색 결과 없음", items: [milk], query: "없는 품목" },
  ])("$label 아래에서 관리 시트를 열어요", ({ items, query }) => {
    navigation.search = new URLSearchParams({ q: query });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["inventory"], items);
    client.setQueryData(["inventory-meta"], inventoryMeta);
    const { container, unmount } = render(
      <QueryClientProvider client={client}>
        <InventoryPage />
      </QueryClientProvider>,
    );
    const header = container.querySelector<HTMLElement>(
      '[data-od-id="inventory-header"]',
    )!;
    expect(within(header).getByRole("button", { name: "등록" })).toBeEnabled();
    expect(within(header).queryByText("관리")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-od-id="inv-filter-edit"]'),
    ).toBeNull();
    const manage = screen.getByRole("button", { name: "재고 목록 설정" });
    expect(header).toContainElement(manage);
    fireEvent.click(manage);
    const sheet = screen.getByRole("dialog", { name: "재고 관리" });
    for (const name of ["카테고리 관리", "보관 장소 관리", "단위 관리"]) {
      expect(within(sheet).getByRole("link", { name })).toBeInTheDocument();
    }
    unmount();
    client.clear();
  });

  it.each(["inventory", "inventory-meta"])(
    "%s 로딩 중에는 재고 추가를 막아요",
    (loadingKey) => {
      navigation.search = new URLSearchParams();
      vi.stubGlobal(
        "fetch",
        vi.fn(() => new Promise(() => {})),
      );
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      if (loadingKey !== "inventory")
        client.setQueryData(["inventory"], [milk]);
      if (loadingKey !== "inventory-meta")
        client.setQueryData(["inventory-meta"], inventoryMeta);
      const { unmount } = render(
        <QueryClientProvider client={client}>
          <InventoryPage />
        </QueryClientProvider>,
      );
      expect(screen.getByRole("button", { name: "등록" })).toBeDisabled();
      unmount();
      client.clear();
    },
  );
});

describe("INV-03 INV-15 SCN-INV-2 상태와 수량 캡슐", () => {
  it("한 행만 펼치고 상태 선택·바깥·Escape로 접으며 포커스를 돌려요", async () => {
    const meta = inventoryMeta as InventoryMeta;
    const statusItem: InventoryItem = {
      ...milk,
      id: "capsule-status",
      name: "샴푸",
      mode: "status",
      status: "enough",
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["inventory"], [milk, statusItem]);
    client.setQueryData(["inventory-meta"], meta);
    navigation.search = new URLSearchParams();
    const fetch = vi.fn((_url: string, options?: RequestInit) => {
      const data =
        options?.method === "POST"
          ? [{ ...statusItem, status: "low" }, milk]
          : [milk, { ...statusItem, status: "low" }];
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data })));
    });
    vi.stubGlobal("fetch", fetch);
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <InventoryPage />
      </QueryClientProvider>,
    );
    const status = screen.getByRole("group", { name: "샴푸 상태" });
    const capsule = () =>
      within(status).getByRole("button", { name: /눌러서 바꾸기/ });
    expect(capsule()).not.toHaveAttribute("aria-pressed");
    expect(capsule()).toHaveAttribute("aria-expanded", "false");
    expect(within(status).getAllByRole("button")).toHaveLength(1);
    fireEvent.click(capsule());
    expect(within(status).getAllByRole("button")).toHaveLength(3);
    for (const button of within(status).getAllByRole("button")) {
      expect(button).toHaveAttribute(
        "aria-pressed",
        String(button.textContent === "충분"),
      );
    }
    expect(
      within(status).getByRole("button", { name: "충분" }),
    ).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(
      screen.getByRole("button", { name: /우유 수량 .*눌러서 바꾸기/ }),
    );
    expect(capsule()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "우유 늘리기" })).toHaveFocus();
    fireEvent.click(capsule());
    expect(
      screen.queryByRole("button", { name: "우유 늘리기" }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(capsule()).toHaveFocus();
    fireEvent.click(capsule());
    fireEvent.click(screen.getByRole("heading", { name: "재고" }));
    expect(capsule()).toHaveFocus();
    fireEvent.click(capsule());
    fireEvent.click(within(status).getByRole("button", { name: "부족" }));
    await waitFor(() =>
      expect(
        within(status).getByRole("button", { name: "부족" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(within(status).getAllByRole("button")).toHaveLength(3);
    await waitFor(() =>
      expect(capsule()).toHaveAttribute("aria-expanded", "false"),
    );
    expect(capsule()).toHaveTextContent("부족");
    expect(capsule()).toHaveFocus();
    const write = fetch.mock.calls.find(
      ([, options]) => options?.method === "POST",
    );
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({
      action: "status",
      id: statusItem.id,
      status: "low",
    });
    unmount();
    client.clear();
  });
});

it("INV-01 SCN-INV-1 모바일 당기기는 기존 재고 등록을 열어요", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["inventory"], [milk]);
  client.setQueryData(["inventory-meta"], inventoryMeta);
  navigation.search = new URLSearchParams();
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <InventoryPage />
    </QueryClientProvider>,
  );
  const surface = document.querySelector('[data-od-id="inventory-main"]')!;
  fireEvent.touchStart(surface, { touches: [{ clientX: 0, clientY: 0 }] });
  fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 40 }] });
  expect(screen.getByText("당겨서 재고 등록하기")).toBeVisible();
  const arrow = screen.getByText("당겨서 재고 등록하기").querySelector("svg")!;
  expect(arrow).toHaveAttribute("aria-hidden", "true");
  expect(arrow).not.toHaveClass("rotate-180");
  fireEvent.touchMove(surface, { touches: [{ clientX: 0, clientY: 90 }] });
  expect(screen.getByText("당겨서 재고 등록하기")).toBeVisible();
  expect(arrow).toHaveClass("rotate-180");
  fireEvent.touchEnd(surface, { touches: [] });

  expect(screen.getByRole("dialog", { name: "새 품목" })).toBeVisible();
  unmount();
  client.clear();
});
