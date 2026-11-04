import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { useChatSend } from "../../model/use-chat-send";
import ChatComposer from ".";

vi.mock("@/entities/chat-message", () => ({
  postChat: vi.fn(() => new Promise(() => {})),
  uploadPhoto: vi.fn(),
}));
const Composer = () => <ChatComposer reply={useChatSend(1)} />;
it("BOT-01 사진 첨부·보내기 이름과 전송 중 표시·중복 방지를 유지해요", async () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Composer />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("button", { name: "사진 첨부" })).toBeEnabled();
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "메시지" },
  });
  fireEvent.click(screen.getByRole("button", { name: "보내기" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "보내는 중" })).toBeDisabled(),
  );
  expect(screen.getByRole("button", { name: "사진 첨부" })).toBeDisabled();
  expect(
    screen
      .getByRole("button", { name: "보내는 중" })
      .querySelector(".lucide-loader-circle"),
  ).toBeInTheDocument();
  client.clear();
});
