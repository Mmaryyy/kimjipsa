import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FormSheet, Sheet, useConfirm } from "@/shared/ui";
import { ConfirmProvider } from "./confirm-provider";
const navigation = vi.hoisted(() => ({ pathname: "/cart" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

function RequestButton({
  onResult,
  onConfirm,
  disabled,
}: {
  onResult: (result: boolean) => void;
  onConfirm?: () => Promise<unknown>;
  disabled?: () => boolean;
}) {
  const confirm = useConfirm();
  return (
    <button
      onClick={() =>
        void confirm({
          title: "확인할까요?",
          description: "확인 안내",
          confirmLabel: "확인",
          onConfirm,
          disabled,
        }).then(onResult)
      }
    >
      확인 요청
    </button>
  );
}

function FormExample({
  onSubmit,
  disabled = false,
}: {
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  return (
    <FormSheet
      open={open}
      onOpenChange={setOpen}
      dirty={dirty}
      submitDisabled={disabled}
      title="등록"
      description="입력해 주세요"
    >
      {(formId) => (
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <input aria-label="이름" onChange={() => setDirty(true)} />
          <RequestButton onResult={() => {}} />
        </form>
      )}
    </FormSheet>
  );
}

describe("CAL-01 CAL-12 SCN-CAL-1 SCN-CAL-7 P15.1 공용 폼과 확인창", () => {
  it.each([true, false])(
    "확인 여부 %s를 Promise로 반환해요",
    async (confirmed) => {
      const onResult = vi.fn();
      render(
        <ConfirmProvider>
          <RequestButton onResult={onResult} />
        </ConfirmProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "확인 요청" }));
      fireEvent.click(
        screen.getByRole("button", { name: confirmed ? "확인" : "취소하기" }),
      );
      await waitFor(() => expect(onResult).toHaveBeenCalledWith(confirmed));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    },
  );

  it("비동기 확인 중 중복 누름과 ESC를 막고 오류 뒤 재시도해요", async () => {
    let reject!: (error: Error) => void;
    const onConfirm = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <RequestButton onResult={onResult} onConfirm={onConfirm} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "확인 요청" }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(
      screen.getByRole("button", { name: "처리하고 있어요" }),
    ).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await act(async () => reject(new Error("연결을 확인해 주세요")));
    expect(screen.getByRole("alert")).toHaveTextContent("연결을 확인해 주세요");
    expect(onResult).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("시트 위 확인창의 Tab을 가두고 바깥 누름은 무시하며 ESC 뒤 연 버튼으로 돌아와요", async () => {
    const onChange = vi.fn();
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <Sheet open onOpenChange={onChange} title="상세" description="내용">
          <RequestButton onResult={onResult} />
        </Sheet>
      </ConfirmProvider>,
    );
    const opener = screen.getByRole("button", { name: "확인 요청" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("alertdialog");
    const cancel = within(dialog).getByRole("button", { name: "취소하기" });
    const submit = within(dialog).getByRole("button", { name: "확인" });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(submit).toHaveFocus();
    fireEvent.keyDown(submit, { key: "Tab" });
    expect(cancel).toHaveFocus();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const overlay = document.querySelector(".kj-overlay.z-84")!;
    fireEvent.pointerDown(overlay, { button: 0 });
    fireEvent.click(overlay);
    expect(dialog).toBeVisible();
    fireEvent.keyDown(cancel, { key: "Escape" });
    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "상세" })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("머리 제출과 dirty 저장이 내부 폼의 검증과 제출을 거쳐요", async () => {
    const onSubmit = vi.fn();
    render(
      <ConfirmProvider>
        <FormExample onSubmit={onSubmit} />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "저장",
      }),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("이름")).toHaveValue("수정");
  });

  it("뒤로 가기는 경로와 입력을 유지하며 닫기 확인을 먼저 열어요", async () => {
    const path = window.location.href;
    render(
      <ConfirmProvider>
        <FormExample onSubmit={vi.fn()} />
      </ConfirmProvider>,
    );
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "수정" },
    });
    act(() => window.history.back());
    await screen.findByRole("alertdialog");
    expect(window.location.href).toBe(path);
    fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));
    expect(screen.getByLabelText("이름")).toHaveValue("수정");
    act(() => window.history.back());
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "저장 안 함" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(window.location.href).toBe(path);
  });
  it("경로가 바뀌면 열린 요청과 대기 요청을 모두 취소해요", async () => {
    navigation.pathname = "/cart";
    const onResult = vi.fn();
    const onConfirm = vi.fn();
    const view = render(
      <ConfirmProvider>
        <RequestButton onResult={onResult} onConfirm={onConfirm} />
      </ConfirmProvider>,
    );
    const opener = screen.getByRole("button", { name: "확인 요청" });
    fireEvent.click(opener);
    fireEvent.click(opener);
    navigation.pathname = "/settings";
    view.rerender(
      <ConfirmProvider>
        <RequestButton onResult={onResult} onConfirm={onConfirm} />
      </ConfirmProvider>,
    );
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls).toEqual([[false], [false]]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("확인창을 연 뒤 실행 불가가 되면 작업 대신 안내를 보여 줘요", async () => {
    let disabled = false;
    const onConfirm = vi.fn();
    render(
      <ConfirmProvider>
        <RequestButton
          onResult={vi.fn()}
          onConfirm={onConfirm}
          disabled={() => disabled}
        />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "확인 요청" }));
    disabled = true;
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "지금은 실행할 수 없어요",
    );
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeVisible();
  });

  it.each([true, false])(
    "다른 확인창이 열렸으면 dirty %s 폼의 뒤로가기는 무시해요",
    async (dirty) => {
      render(
        <ConfirmProvider>
          <FormExample onSubmit={vi.fn()} />
        </ConfirmProvider>,
      );
      if (dirty)
        fireEvent.change(screen.getByLabelText("이름"), {
          target: { value: "수정" },
        });
      fireEvent.click(screen.getByRole("button", { name: "확인 요청" }));
      act(() => window.dispatchEvent(new PopStateEvent("popstate")));
      fireEvent.click(screen.getByRole("button", { name: "취소하기" }));
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("dialog", { name: "등록" })).toBeVisible();
    },
  );

  it("닫기 확인을 연 뒤 저장 불가가 되면 안내하고 저장 안 함은 허용해요", async () => {
    const onSubmit = vi.fn();
    const view = render(
      <ConfirmProvider>
        <FormExample onSubmit={onSubmit} />
      </ConfirmProvider>,
    );
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "수정" },
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    view.rerender(
      <ConfirmProvider>
        <FormExample onSubmit={onSubmit} disabled />
      </ConfirmProvider>,
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "저장",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "지금은 저장할 수 없어요",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장 안 함" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
