import { cleanup, render, screen } from "@testing-library/react";
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
vi.mock("./navigation-link-list", () => ({ NavigationLinkList: () => null }));
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
