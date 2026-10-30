import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/shared/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "./profile-form";

const { updateProfile } = vi.hoisted(() => ({ updateProfile: vi.fn() }));
vi.mock("../api/api", () => ({ updateProfile }));

function renderProfile(displayName?: string, reconsent = false) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileForm displayName={displayName} reconsent={reconsent} />
    </QueryClientProvider>,
  );
}

function fillProfile(name = "살림이") {
  const input = screen.getByRole("textbox", { name: "표시 이름" });
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "이용약관 동의 (필수)" }),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "개인정보 처리방침 동의 (필수)" }),
  );
  return input;
}

beforeEach(() => {
  vi.resetAllMocks();
  updateProfile.mockResolvedValue(null);
});

describe("ACC-02 SCN-ACC-1 약관 동의 팝업", () => {
  it.each([
    {
      name: "이용약관",
      heading: "제1조(목적)",
      checkedLabel: "이용약관 동의 (필수)",
      uncheckedLabel: "개인정보 처리방침 동의 (필수)",
    },
    {
      name: "개인정보 처리방침",
      heading: "1. 수집하는 개인정보 항목 및 이용 목적",
      checkedLabel: "개인정보 처리방침 동의 (필수)",
      uncheckedLabel: "이용약관 동의 (필수)",
    },
  ])(
    "$name 본문을 시트로 열고 닫아도 입력과 체크 상태를 유지해요",
    async ({ name, heading, checkedLabel, uncheckedLabel }) => {
      renderProfile();
      const displayName = screen.getByRole("textbox", { name: "표시 이름" });
      const checked = screen.getByRole("checkbox", { name: checkedLabel });
      const unchecked = screen.getByRole("checkbox", { name: uncheckedLabel });
      const trigger = screen.getByRole("button", { name: `${name} 보기` });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      fireEvent.change(displayName, { target: { value: "살림이" } });
      fireEvent.click(checked);
      trigger.focus();
      fireEvent.click(trigger);

      const sheet = screen.getByRole("dialog", { name });
      expect(
        within(sheet).getByRole("heading", { name: heading }),
      ).toBeVisible();
      expect(within(sheet).queryByText(/초안/)).not.toBeInTheDocument();
      fireEvent.click(within(sheet).getByRole("button", { name: "닫기" }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
      });
      expect(displayName).toHaveValue("살림이");
      expect(checked).toBeChecked();
      expect(unchecked).not.toBeChecked();

      fireEvent.click(trigger);
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(displayName).toHaveValue("살림이");
      expect(checked).toBeChecked();
      expect(unchecked).not.toBeChecked();
    },
  );
});

describe("ACC-02 SCN-ACC-1 프로필 제출과 오류 위치", () => {
  it("입력한 이름과 실제 동의 상태를 전송해요", async () => {
    renderProfile();
    fireEvent.change(screen.getByRole("textbox", { name: "표시 이름" }), {
      target: { value: "  😀😀😀😀😀😀  " },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "이용약관 동의 (필수)" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "개인정보 처리방침 동의 (필수)" }),
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "동의하고 계속" }).closest("form")!,
    );
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        {
          displayName: "😀😀😀😀😀😀",
          termsAccepted: true,
          privacyAccepted: true,
        },
        expect.anything(),
      ),
    );
  });

  it.each([
    ["display_name_too_long", "name"],
    ["display_name_required", "name"],
    ["display_name_invalid", "name"],
    ["consent_required", "consent"],
    ["network_error", "form"],
  ])("%s 오류를 알맞은 위치에 표시해요", async (code, location) => {
    updateProfile.mockRejectedValue(new ApiError(code, "입력을 확인해 주세요"));
    renderProfile();
    const input = fillProfile();
    fireEvent.submit(input.closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(input.hasAttribute("aria-invalid")).toBe(location === "name");
    expect(alert.closest("fieldset") !== null).toBe(location === "consent");
    if (location === "name")
      expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    if (location === "form")
      expect(alert.parentElement).toBe(input.closest("form"));
  });
});

describe("ACC-02 SCN-ACC-1 클라이언트 검증과 제출 상태", () => {
  it.each([
    ["   ", "표시 이름을 입력해 주세요."],
    ["일이삼사오육칠", "표시 이름은 6자 이하로 입력해 주세요."],
    ["😀😀😀😀😀😀😀", "표시 이름은 6자 이하로 입력해 주세요."],
  ])(
    "표시 이름 %s의 오류를 필드에 연결하고 전송하지 않아요",
    async (name, message) => {
      renderProfile();
      const input = fillProfile(name);
      fireEvent.submit(input.closest("form")!);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(message);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input.getAttribute("aria-describedby")).toContain(alert.id);
      expect(input).toHaveAccessibleDescription(
        expect.stringContaining("6자 이하"),
      );
      expect(updateProfile).not.toHaveBeenCalled();
    },
  );

  it.each(["이용약관 동의 (필수)", "개인정보 처리방침 동의 (필수)"])(
    "%s만 선택하면 동의 오류를 fieldset 안에 표시해요",
    async (label) => {
      renderProfile();
      const input = screen.getByRole("textbox", { name: "표시 이름" });
      fireEvent.change(input, { target: { value: "살림이" } });
      fireEvent.click(screen.getByRole("checkbox", { name: label }));
      fireEvent.submit(input.closest("form")!);
      const alert = await screen.findByRole("alert");
      expect(alert.closest("fieldset")).not.toBeNull();
      expect(updateProfile).not.toHaveBeenCalled();
    },
  );

  it("기존 프로필은 동의 입력 없이 이름을 저장해요", async () => {
    renderProfile("살림이");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "표시 이름 저장" }));
    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        { displayName: "살림이" },
        expect.anything(),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "표시 이름을 저장했어요.",
    );
  });

  it("저장 중에는 제출 버튼이 비활성화되고 폼이 busy 상태예요", async () => {
    let resolveSave!: (value: null) => void;
    updateProfile.mockReturnValue(
      new Promise<null>((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderProfile();
    const input = fillProfile();
    fireEvent.submit(input.closest("form")!);
    const button = await screen.findByRole("button", {
      name: "저장하고 있어요",
    });
    expect(button).toBeDisabled();
    expect(input.closest("form")).toHaveAttribute("aria-busy", "true");
    resolveSave(null);
    await waitFor(() => expect(button).toBeEnabled());
    expect(input.closest("form")).toHaveAttribute("aria-busy", "false");
  });
});

describe("ACC-02 SCN-ACC-1 모두 동의", () => {
  it("모두 동의와 개별 동의가 연동되고 제출 가능 상태가 바뀌어요", () => {
    renderProfile();
    const all = screen.getByRole("checkbox", { name: "모두 동의" });
    const submit = screen.getByRole("button", { name: "동의하고 계속" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("동의해야 계속할 수 있어요")).toBeVisible();
    expect(submit).toHaveAccessibleDescription("동의해야 계속할 수 있어요");
    fireEvent.click(all);
    expect(
      screen.getByRole("checkbox", { name: "이용약관 동의 (필수)" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "개인정보 처리방침 동의 (필수)" }),
    ).toBeChecked();
    expect(submit).toBeEnabled();
    expect(
      screen.queryByText("동의해야 계속할 수 있어요"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "이용약관 동의 (필수)" }),
    );
    expect(all).not.toBeChecked();
    expect(submit).toBeDisabled();
  });
});

it("ACC-02 SCN-ACC-1 재동의는 기존 이름을 유지하고 두 항목을 새로 동의해야 저장해요", async () => {
  renderProfile("살림이", true);
  expect(screen.getByRole("textbox", { name: "표시 이름" })).toHaveValue(
    "살림이",
  );
  expect(screen.getByRole("button", { name: "동의하고 계속" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "모두 동의" }));
  fireEvent.click(screen.getByRole("button", { name: "동의하고 계속" }));
  await waitFor(() =>
    expect(updateProfile).toHaveBeenCalledWith(
      { displayName: "살림이", termsAccepted: true, privacyAccepted: true },
      expect.anything(),
    ),
  );
});
