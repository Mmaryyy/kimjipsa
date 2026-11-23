import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { uploadPhoto } from "@/entities/chat-message";
import { useChatSend } from "../../model/use-chat-send";
import ChatComposer from ".";

vi.mock("@/entities/chat-message", () => ({
  postChat: vi.fn(() => new Promise(() => {})),
  uploadPhoto: vi.fn(),
}));
vi.mock("../../model/photo.utils", () => ({
  compressPhoto: async (file: File) => file,
}));

const Composer = () => <ChatComposer reply={useChatSend(1)} />;
const renderComposer = () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <Composer />
    </QueryClientProvider>,
  );
  return client;
};

it("BOT-01 사진 첨부·보내기 이름과 전송 중 표시·중복 방지를 유지해요", async () => {
  const client = renderComposer();
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

it.each([
  { existing: 0, expected: 3 },
  { existing: 2, expected: 4 },
])(
  "INV-17 사진이 $existing장 있을 때 3장을 고르면 총 $expected장을 첨부해요",
  async ({ existing, expected }) => {
    const files = Array.from(
      { length: existing + 3 },
      (_, index) =>
        new File(["photo"], `photo-${index}.jpg`, { type: "image/jpeg" }),
    );
    const upload = vi.mocked(uploadPhoto).mockReset();
    for (const file of files) upload.mockResolvedValueOnce(file.name);
    const client = renderComposer();
    const input = screen.getByLabelText("사진 선택");
    const attach = screen.getByRole("button", { name: "사진 첨부" });
    const attachedPhotos = () =>
      within(screen.getByRole("list", { name: "전송할 사진" })).getAllByRole(
        "listitem",
      );
    expect(input).toHaveAttribute("multiple");

    if (existing > 0) {
      fireEvent.change(input, { target: { files: files.slice(0, existing) } });
      await waitFor(() => {
        expect(attachedPhotos()).toHaveLength(existing);
        expect(attach).toBeEnabled();
      });
    }

    fireEvent.change(input, { target: { files: files.slice(existing) } });
    await waitFor(() => expect(attachedPhotos()).toHaveLength(expected));
    expect(upload.mock.calls).toEqual(
      files.slice(0, expected).map((file) => [file]),
    );
    if (existing > 0) {
      expect(attach).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent(
        "사진은 한 번에 4장까지 보낼 수 있어요.",
      );
    }
    client.clear();
  },
);
