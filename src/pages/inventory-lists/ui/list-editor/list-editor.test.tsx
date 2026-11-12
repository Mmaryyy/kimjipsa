import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ConfirmTestProvider } from "@/shared/ui/confirm-test-provider";
import type { InventoryMetaEntry } from "@/entities/inventory-item";
import InventoryListEditor from ".";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/entities/inventory-item", async (load) => ({
  ...(await load<object>()),
  useInventoryActions: () => ({
    meta: { mutateAsync: save, isPending: false },
  }),
}));
const entry: InventoryMetaEntry = {
  id: "entry",
  name: "식품",
  enabled: true,
  sort_order: 0,
  icon_kind: null,
  icon_value: "",
};
const close = vi.fn();
function mount(name = "식품") {
  return render(
    <ConfirmTestProvider>
      <InventoryListEditor
        kind="categories"
        nextSortOrder={1}
        entry={{ ...entry, name }}
        onClose={close}
        onNotify={vi.fn()}
      />
    </ConfirmTestProvider>,
  );
}
beforeEach(() => {
  close.mockReset();
  save.mockReset().mockResolvedValue(null);
});
it.each(["식품", "기타"])(
  "ACC-13 INV-07 P15.1b %s는 먼저 보기로 열고 삭제 가능 여부를 지켜요",
  (name) => {
    mount(name);
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
    expect(Boolean(screen.queryByRole("button", { name: "목록 삭제" }))).toBe(
      name !== "기타",
    );
    fireEvent.click(screen.getByRole("button", { name: "목록 수정" }));
    expect(screen.getByLabelText("이름")).toHaveValue(name);
    expect(
      screen.queryByRole("button", { name: "목록 삭제" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("이름")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "목록 수정" })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
  },
);
it("ACC-13 INV-07 P15.1b 수정 후 저장과 변경 취소 확인을 유지해요", async () => {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "목록 수정" }));
  fireEvent.change(screen.getByLabelText("이름"), {
    target: { value: "먹거리" },
  });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "계속 편집",
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("이름")).toHaveValue("먹거리");
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "save",
        id: "entry",
        entry: expect.objectContaining({ name: "먹거리" }),
      }),
    ),
  );
});
