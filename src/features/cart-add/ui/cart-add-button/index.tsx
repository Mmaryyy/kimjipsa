"use client";
import { useState } from "react";
import { useCart, type CartInput } from "@/entities/cart-item";
import { Button, TextButton, Toast } from "@/shared/ui";
import { useCartAdd } from "../../model/use-cart-add";
interface Props {
  item: CartInput;
  label?: string;
  odId?: string;
  onAdded?: () => void;
  appearance?: "text" | "filled";
}
const CartAddButton = ({
  item,
  label = "담기",
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
        variant="primary"
        aria-label={`${item.name} 장바구니에 담기`}
        data-od-id={odId}
        disabled={disabled}
        onClick={() => void add.onAdd(item)}
      >
        {label}
      </Button>
    ) : (
      <TextButton
        aria-label={`${item.name} 장바구니에 담기`}
        data-od-id={odId}
        disabled={disabled}
        onClick={() => void add.onAdd(item)}
      >
        {label}
      </TextButton>
    );
  return (
    <>
      {actionButton}

      {add.error && (
        <p role="alert" className="col-span-full text-caption text-error-text">
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
