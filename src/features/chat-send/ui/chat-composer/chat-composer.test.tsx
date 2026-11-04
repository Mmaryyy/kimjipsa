import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import ChatComposer from ".";

const state = vi.hoisted(() => ({ pending: false }));
vi.mock("../../model/use-chat-send", () => ({
  useChatSend: () => ({
    text: "메시지",
    photos: [],
    onText: vi.fn(),
    onRemove: vi.fn(),
    send: { isPending: state.pending, mutate: vi.fn() },
    upload: { isPending: false },
  }),
}));
beforeEach(() => {
  state.pending = false;
});
it("BOT-01 사진 첨부·보내기 이름과 전송 중 표시·중복 방지를 유지해요", () => {
  const view = render(<ChatComposer sessionVersion={1} />);
  expect(screen.getByRole("button", { name: "사진 첨부" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "보내기" })).toBeEnabled();
  state.pending = true;
  view.rerender(<ChatComposer sessionVersion={1} />);
  const sending = screen.getByRole("button", {
    name: "보내는 중",
  });
  expect(sending).toBeDisabled();
  expect(sending.querySelector(".lucide-loader-circle")).toBeInTheDocument();
});
