import type { Ref } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, Input } from "@/shared/ui";
import type { useCartQuickAdd } from "../../model/use-cart-quick-add";
interface Props {
  inputRef: Ref<HTMLInputElement>;
  quickAdd: ReturnType<typeof useCartQuickAdd>;
  pending: boolean;
}
const CartQuickAddForm = ({ inputRef, quickAdd, pending }: Props) => {
  const { name, onNameChange, add, onQuickAdd } = quickAdd;
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
        <Input
          ref={inputRef}
          variant="glass"
          className="min-h-[var(--ctl-h)] flex-1"
          aria-label="항목 추가"
          aria-describedby="cart-add-status"
          placeholder="항목 추가 (예: 두부 2모)"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={pending || add.pending}
        />
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
      {add.error && (
        <p role="alert" className="mt-2 text-caption text-error-text">
          {add.error}
        </p>
      )}
    </>
  );
};
export default CartQuickAddForm;
