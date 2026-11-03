import { CartDuplicateDialog } from "@/features/cart-add";
import { Button, Input, ConfirmDialog } from "@/shared/ui";
import type { useCartQuickAdd } from "../../model/use-cart-quick-add";
interface Props {
  quickAdd: ReturnType<typeof useCartQuickAdd>;
  pending: boolean;
  offline: boolean;
}
const CartQuickAddForm = ({ quickAdd, pending, offline }: Props) => {
  const {
    name,
    onNameChange,
    add,
    unknownUnit,
    unitError,
    resolvingUnit,
    onQuickAdd,
    onResolveUnit,
    onUnitOpenChange,
  } = quickAdd;
  return (
    <>
      <form
        data-od-id="cart-add-form"
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !pending && !add.pending) onQuickAdd();
        }}
      >
        <Input
          aria-label="항목 추가"
          placeholder="항목 추가 (예: 두부 2모)"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={pending || add.pending}
          className="min-h-[var(--ctl-h)] min-w-0 flex-1 bg-muted py-1"
        />
        <Button
          type="submit"
          size="sm"
          data-od-id="cart-add-submit"
          disabled={pending || add.pending || !name.trim()}
        >
          추가
        </Button>
      </form>
      {add.error && !add.duplicate && (
        <p role="alert" className="mt-2 text-caption text-error-text">
          {add.error}
        </p>
      )}
      <ConfirmDialog
        open={unknownUnit !== null}
        onOpenChange={onUnitOpenChange}
        title={`'${unknownUnit?.name ?? ""}' 단위를 추가할까요?`}
        description="추가하지 않으면 기본 단위 ‘개’로 담아요."
        confirmLabel="단위 추가"
        cancelLabel="취소"
        secondaryAction={{
          label: "개로 담기",
          onClick: () => void onResolveUnit(false),
        }}
        destructive={false}
        pending={resolvingUnit || pending}
        onConfirm={() => void onResolveUnit(true)}
      >
        {unitError && (
          <p role="alert" className="text-caption text-error-text">
            {unitError}
          </p>
        )}
      </ConfirmDialog>
      <CartDuplicateDialog
        duplicate={add.duplicate}
        pending={add.pending}
        disabled={offline}
        error={add.error}
        onChoose={(input, choice) => void add.onAdd(input, choice)}
        onClose={() => add.setDuplicate(null)}
      />
    </>
  );
};
export default CartQuickAddForm;
