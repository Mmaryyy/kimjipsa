import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SidebarNavigation } from "./sidebar-navigation";

const { members } = vi.hoisted(() => ({
  members: [
    { user_id: "me", display_name: "지수" },
    { user_id: "partner", display_name: "지수" },
  ],
}));
vi.mock("@/features/account", () => ({
  useAccount: () => ({
    data: { userId: "me", profile: { displayName: "새이름" } },
  }),
}));
vi.mock("@/features/family", () => ({
  useFamily: () => ({ data: { name: "우리 집", members } }),
}));
const { chat } = vi.hoisted(() => ({
  chat: { minimized: false, ready: true, onOpen: vi.fn() },
}));
vi.mock("@/features/chat-navigation", () => ({
  useChatNavigation: () => chat,
}));
afterEach(cleanup);

it("ACC-07 내 이름이 바뀌어도 id로 나만 제외하고 동명이인 구성원을 보여요", () => {
  render(<SidebarNavigation pathname="/" />);
  expect(screen.getByText("지수 님과 함께")).toBeInTheDocument();
  expect(screen.queryByText(/새이름 님과 함께/)).not.toBeInTheDocument();
});

it("ACC-07 혼자일 때 함께하는 구성원 줄을 숨겨요", () => {
  const partner = members.pop()!;
  try {
    render(<SidebarNavigation pathname="/" />);
    expect(screen.queryByText(/님과 함께/)).not.toBeInTheDocument();
  } finally {
    members.push(partner);
  }
});

it("ACC-18 SCN-PRJ-6 사이드에서 재고만 선택하고 집사는 설정 앞에 추가해요", () => {
  const { rerender } = render(<SidebarNavigation pathname="/inventory" />);
  const menu = within(screen.getByRole("list"));
  const labels = () =>
    menu.getAllByRole("link").map((link) => link.textContent);
  expect(labels()).toEqual([
    "오늘",
    "일정",
    "장바구니",
    "재고",
    "프로젝트",
    "설정",
  ]);
  expect(menu.getByRole("link", { current: "page" })).toHaveTextContent("재고");

  chat.minimized = true;
  try {
    rerender(<SidebarNavigation pathname="/inventory" />);
    expect(labels()).toEqual([
      "오늘",
      "일정",
      "장바구니",
      "재고",
      "프로젝트",
      "집사",
      "설정",
    ]);
  } finally {
    chat.minimized = false;
  }
});

it("ACC-18 구매 반영에서는 사이드의 장바구니만 선택해요", () => {
  render(<SidebarNavigation pathname="/restock" />);
  const menu = within(screen.getByRole("list"));
  expect(menu.getByRole("link", { current: "page" })).toHaveTextContent(
    "장바구니",
  );
});
