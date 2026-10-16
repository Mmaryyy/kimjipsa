import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { CreateFamilyForm } from "./create-family-form";

const { createFamily } = vi.hoisted(() => ({ createFamily: vi.fn() }));
vi.mock("../api/api", () => ({ createFamily }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

function renderFamily() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CreateFamilyForm />
    </QueryClientProvider>,
  );
}

describe("ACC-03 SCN-ACC-1 가정 만들기 오류 위치", () => {
  beforeEach(() => vi.resetAllMocks());
  it.each([
    "family_name_too_long",
    "family_name_required",
    "validation_failed",
    "already_in_family",
    "profile_required",
    "network_error",
  ])("%s 오류를 알맞은 위치에 표시해요", async (code) => {
    createFamily.mockRejectedValue(new ApiError(code, "확인해 주세요"));
    renderFamily();
    const input = screen.getByRole("textbox", { name: "가정 이름" });
    fireEvent.change(input, { target: { value: "데비네" } });
    fireEvent.submit(input.closest("form")!);
    const alert = await screen.findByRole("alert");
    const fieldError =
      code.startsWith("family_name_") || code === "validation_failed";
    expect(input.hasAttribute("aria-invalid")).toBe(fieldError);
    if (fieldError)
      expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    else expect(alert.parentElement).toBe(input.closest("form"));
    expect(input).toHaveAccessibleDescription(
      expect.stringContaining("10자 이하"),
    );
  });
});

describe("ACC-03 SCN-ACC-1 가정 이름 검증과 제출", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createFamily.mockResolvedValue("family-id");
  });

  it("공백을 정리하고 코드포인트 10자인 이름을 전송해요", async () => {
    renderFamily();
    const input = screen.getByRole("textbox", { name: "가정 이름" });
    fireEvent.change(input, { target: { value: "  😀😀😀😀😀😀😀😀😀😀  " } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() =>
      expect(createFamily).toHaveBeenCalledWith(
        "😀😀😀😀😀😀😀😀😀😀",
        expect.anything(),
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["   ", "가정 이름을 입력해 주세요."],
    ["일이삼사오육칠팔구십일", "가정 이름은 10자 이하로 입력해 주세요."],
    ["😀😀😀😀😀😀😀😀😀😀😀", "가정 이름은 10자 이하로 입력해 주세요."],
  ])(
    "가정 이름 %s의 오류를 필드에 연결하고 전송하지 않아요",
    async (name, message) => {
      renderFamily();
      const input = screen.getByRole("textbox", { name: "가정 이름" });
      fireEvent.change(input, { target: { value: name } });
      fireEvent.submit(input.closest("form")!);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(message);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input.getAttribute("aria-describedby")).toContain(alert.id);
      expect(createFamily).not.toHaveBeenCalled();
    },
  );

  it("생성 중에는 제출 버튼이 비활성화되고 폼이 busy 상태예요", async () => {
    let resolveCreate!: (value: string) => void;
    createFamily.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    renderFamily();
    const input = screen.getByRole("textbox", { name: "가정 이름" });
    fireEvent.change(input, { target: { value: "데비네" } });
    fireEvent.submit(input.closest("form")!);
    const button = await screen.findByRole("button", {
      name: "우리 집을 만들고 있어요",
    });
    expect(button).toBeDisabled();
    expect(input.closest("form")).toHaveAttribute("aria-busy", "true");
    resolveCreate("family-id");
    await waitFor(() => expect(button).toBeEnabled());
    expect(input.closest("form")).toHaveAttribute("aria-busy", "false");
  });
});
