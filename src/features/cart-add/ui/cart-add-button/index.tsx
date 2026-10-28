"use client";
import { useState } from "react";
import { useCart, type CartInput } from "@/entities/cart-item";
import { Button, TextButton, Toast } from "@/shared/ui";
import { useCartAdd } from "../../model/use-cart-add";
import CartDuplicateDialog from "../cart-duplicate-dialog";
interface Props {
  item: CartInput;
  odId?: string;
  onAdded?: () => void;
  appearance?: "text" | "filled";
}
const CartAddButton = ({
  item,
  odId = "item-to-cart",
  onAdded,
  appearance = "text",
}: Props) => {
  const cart = useCart();
  const [message, setMessage] = useState("");
  const add = useCartAdd((message) => {
    setMessage(message);
    onAdded?.();
  });
  const disabled = cart.offline || !cart.data || add.pending;
  const actionButton =
    appearance === "filled" ? (
      <Button
        variant="gray"
        data-od-id={odId}
        disabled={disabled}
        onClick={() => void add.onAdd(item)}
      >
        장바구니에 담기
      </Button>
    ) : (
      <TextButton
        data-od-id={odId}
        disabled={disabled}
        onClick={() => void add.onAdd(item)}
      >
        장바구니에 담기
      </TextButton>
    );
  return (
    <>
      {actionButton}
      <CartDuplicateDialog
        duplicate={add.duplicate}
        pending={add.pending}
        disabled={cart.offline}
        error={add.error}
        onChoose={(input, choice) => void add.onAdd(input, choice)}
        onClose={() => add.setDuplicate(null)}
      />
      {add.error && !add.duplicate && (
        <p role="alert" className="text-caption text-error-text">
          {add.error}
        </p>
      )}
      <Toast
        open={!!message}
        onOpenChange={(open) => {
          if (!open) setMessage("");
        }}
        message={message}
      />
    </>
  );
};
export default CartAddButton;
