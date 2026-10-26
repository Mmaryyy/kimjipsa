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
  const { data = [] } = useInventory();
  const actions = useInventoryActions();
  return (
    <ul>
      {data.map((item) => (
        <InventoryItemRow
          key={item.id}
          item={item}
          meta={inventoryMeta as InventoryMeta}
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
      selectTab(empty.name);
      expectCounts(0, 0, 0);
      selectTab("전체");
      expectCounts(1, 2, 2);
      unmount();
      client.clear();
    },
  );
});
