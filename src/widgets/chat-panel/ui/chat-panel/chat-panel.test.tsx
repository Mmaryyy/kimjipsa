import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Chat } from "@/entities/chat-message";
import ChatMessages from "./Messages";
import { chatFaqs } from "../../config/chat.constants";

const message = (id: string): Chat["messages"][number] => ({
  id,
  sequence: 1,
  role: "user",
  text: id,
  author: "나",
  created_at: "2026-11-04T03:00:00Z",
  visibility: "private",
  attachment_ids: [],
  sources: [],
  choices: [],
});

it("BOT-03 인사·기능 목록은 기존 대화 맨 앞에 있고 FAQ는 로컬 질문·답을 덧붙여요", () => {
  const view = render(
    <ol>
      <ChatMessages
        key="1"
        name="데비"
        displayName="마리"
        messages={[message("기존 대화")]}
      >
        {(item) => <li>{item.text}</li>}
      </ChatMessages>
    </ol>,
  );
  const greeting = screen.getByText(
    "안녕하세요, 마리님. 김데비예요. 이런 일을 도와드릴 수 있어요.",
  );
  expect(greeting.closest("li")?.previousElementSibling).toHaveAttribute(
    "role",
    "separator",
  );
  expect(within(greeting.closest("li")!).getAllByRole("listitem")).toHaveLength(
    3,
  );
  fireEvent.click(screen.getByRole("button", { name: chatFaqs[0].title }));
  fireEvent.click(screen.getByRole("button", { name: chatFaqs[1].title }));
  expect(screen.getByText(chatFaqs[0].answer)).toBeVisible();
  expect(screen.getByText(chatFaqs[1].answer)).toBeVisible();
  expect(screen.getAllByText(chatFaqs[0].title)).toHaveLength(2);
  expect(screen.getByText("기존 대화").nextElementSibling).toHaveTextContent(
    chatFaqs[0].title,
  );
  view.rerender(
    <ol>
      <ChatMessages
        key="2"
        name="데비"
        displayName="마리"
        messages={[message("새 대화")]}
      >
        {(item) => <li>{item.text}</li>}
      </ChatMessages>
    </ol>,
  );
  expect(screen.queryByText(chatFaqs[0].answer)).not.toBeInTheDocument();
  expect(greeting).not.toBeInTheDocument();
  expect(screen.getByText(/안녕하세요, 마리님/)).toBeVisible();
});

it("BOT-03 FAQ 뒤에 보낸 대화와 이전 대화를 불러와도 클릭 순서를 유지해요", () => {
  const conversation = (ids: string[]) => (
    <ol>
      <ChatMessages name="데비" displayName="마리" messages={ids.map(message)}>
        {(item) => <li>{item.text}</li>}
      </ChatMessages>
    </ol>
  );
  const view = render(conversation([]));
  fireEvent.click(screen.getByRole("button", { name: chatFaqs[0].title }));
  view.rerender(conversation(["첫 전송"]));
  expect(
    screen.getByText(chatFaqs[0].answer).closest("li")?.nextElementSibling,
  ).toHaveTextContent("첫 전송");
  fireEvent.click(screen.getByRole("button", { name: chatFaqs[1].title }));
  view.rerender(conversation(["이전 대화", "첫 전송", "추가 전송"]));
  expect(screen.getByText("첫 전송").nextElementSibling).toHaveTextContent(
    chatFaqs[1].answer,
  );
  expect(
    screen.getByText(chatFaqs[1].answer).closest("li")?.nextElementSibling,
  ).toHaveTextContent("추가 전송");
});

vi.mock("@/features/account", () => ({
  useBotCharacter: () => ({ avatar: "/images/kimjipsa-avatar.png" }),
}));

it("BOT-01 인사 위에 날짜를 표시하고 자정과 이전 대화 추가 시 중복하지 않아요", () => {
  const conversation = (messages: Chat["messages"]) => (
    <ol role="log">
      <ChatMessages name="데비" displayName="마리" messages={messages}>
        {(item) => <li>{item.text}</li>}
      </ChatMessages>
    </ol>
  );
  const view = render(conversation([]));
  expect(screen.getAllByRole("separator")).toHaveLength(1);
  expect(screen.getByText("김데비")).toHaveClass("sr-only");
  const first = { ...message("첫 메시지"), created_at: "2026-11-10T14:59:00Z" };
  view.rerender(
    conversation([first, { ...first, id: "same", text: "같은 날" }]),
  );
  expect(screen.getAllByRole("separator")).toHaveLength(1);
  expect(screen.getByRole("separator")).toHaveAccessibleName(
    "2026년 11월 10일",
  );
  const next = {
    ...message("자정 메시지"),
    created_at: "2026-11-10T15:00:00Z",
  };
  view.rerender(conversation([first, next]));
  expect(screen.getAllByRole("separator")).toHaveLength(2);
  expect(
    screen.getByRole("separator", { name: "2026년 11월 11일" }),
  ).toBeInTheDocument();
  view.rerender(
    conversation([{ ...first, id: "older", text: "이전 대화" }, first, next]),
  );
  expect(screen.getAllByRole("separator")).toHaveLength(2);
  expect(
    screen.getByRole("separator", { name: "2026년 11월 10일" })
      .nextElementSibling,
  ).toHaveAttribute("data-od-id", "chat-greeting");
  expect(screen.getByText("이전 대화").previousElementSibling).toHaveAttribute(
    "data-od-id",
    "chat-greeting",
  );
});

it("BOT-01 메시지가 없으면 인사 위에 KST 오늘 날짜를 표시해요", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  try {
    render(
      <ol>
        <ChatMessages name="데비" displayName="마리" messages={[]}>
          {(item) => <li>{item.text}</li>}
        </ChatMessages>
      </ol>,
    );
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(
      screen.getByRole("separator", { name: "2026년 11월 11일" })
        .nextElementSibling,
    ).toHaveAttribute("data-od-id", "chat-greeting");
  } finally {
    vi.useRealTimers();
  }
});
