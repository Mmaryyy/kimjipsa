import { LoaderCircle } from "lucide-react";
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
        aria-busy={add.pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !pending && !add.pending) onQuickAdd();
        }}
      >
        <div className="glass-surface relative flex min-w-0 flex-1 items-center">
          <Input
            aria-label="항목 추가"
            aria-describedby="cart-add-status"
            placeholder="항목 추가 (예: 두부 2모)"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={pending || add.pending}
            className="h-full min-h-[var(--ctl-h)] rounded-[var(--r-round)] bg-transparent py-1"
          />
        </div>
        <Button
          type="submit"
          aria-label={add.pending ? "장바구니에 담는 중" : undefined}
          variant="glass"
          size="sm"
          className="text-primary disabled:opacity-40"
          data-od-id="cart-add-submit"
          disabled={pending || add.pending || !name.trim()}
        >
          <span className="relative">
            <span className={add.pending ? "invisible" : undefined}>추가</span>
            {add.pending && (
              <LoaderCircle
                size={16}
                aria-hidden
                className="absolute inset-0 m-auto animate-spin motion-reduce:animate-none"
              />
            )}
          </span>
        </Button>
      </form>
      <p id="cart-add-status" role="status" className="sr-only">
        {add.pending ? "카테고리를 확인하고 장바구니에 담고 있어요." : ""}
      </p>
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
