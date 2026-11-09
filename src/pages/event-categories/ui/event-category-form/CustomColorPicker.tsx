"use client";

import { useRef, useState } from "react";
import { Pipette } from "lucide-react";
import { Popover } from "radix-ui";
import { HexColorPicker } from "react-colorful";
import {
  cn,
  readableTextColor,
  useMediaQuery,
  type CategoryColor,
} from "@/shared/lib";
import { Button, Sheet, TextButton } from "@/shared/ui";

interface Props {
  initialColor: string;
  selected: boolean;
  color: CategoryColor;
  onConfirm: (color: CategoryColor) => void;
}

const EventCategoryCustomColorPicker = ({
  initialColor,
  selected,
  color,
  onConfirm,
}: Props) => {
  const mobile = useMediaQuery("(max-width: 767px)");
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initialColor);
  const onOpenChange = (next: boolean) => {
    if (next) setDraft(initialColor);
    setOpen(next);
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.parentElement
      ?.querySelector("input")
      ?.focus({ preventScroll: true });
  };
  const confirm = () => {
    onConfirm(draft.toLowerCase() as CategoryColor);
    setOpen(false);
  };
  const cancelButton = (
    <TextButton onClick={() => setOpen(false)}>취소</TextButton>
  );
  const confirmButton = <TextButton onClick={confirm}>선택</TextButton>;
  const content = (
    <div
      className="py-4"
      data-vaul-no-drag
      ref={(element) => {
        element
          ?.querySelector('[aria-label="Color"]')
          ?.setAttribute("aria-label", "채도와 밝기");
        element
          ?.querySelector('[aria-label="Hue"]')
          ?.setAttribute("aria-label", "색상");
      }}
    >
      <HexColorPicker
        color={draft}
        onChange={setDraft}
        className={cn(
          "!h-64 !w-full gap-3 md:!h-48",
          String.raw`[&_.react-colorful\_\_saturation]:!rounded-[var(--r-control)]`,
          String.raw`[&_.react-colorful\_\_saturation]:!border-0`,
          String.raw`[&_.react-colorful\_\_hue]:!h-11 [&_.react-colorful\_\_hue]:!rounded-[var(--r-round)]`,
          String.raw`[&_.react-colorful\_\_pointer]:!size-11 [&_.react-colorful\_\_pointer]:!border-white`,
          String.raw`[&_.react-colorful\_\_pointer]:!shadow-[var(--shadow-control)]`,
          String.raw`[&_.react-colorful\_\_interactive:focus-visible_.react-colorful\_\_pointer]:outline-2`,
          String.raw`[&_.react-colorful\_\_interactive:focus-visible_.react-colorful\_\_pointer]:outline-primary`,
        )}
      />
    </div>
  );
  const button = (
    <Button
      ref={trigger}
      tabIndex={-1}
      variant="glass"
      size="icon"
      aria-label="직접 선택"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={mobile ? () => onOpenChange(true) : undefined}
      className={cn(
        "size-9 min-h-9 after:pointer-events-none before:absolute before:-inset-1",
        "peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2",
        selected && "ring-2 ring-primary",
      )}
      style={selected ? { backgroundColor: color } : undefined}
    >
      <Pipette
        aria-hidden="true"
        className="pointer-events-none size-4 text-foreground"
        style={selected ? { color: readableTextColor(color) } : undefined}
      />
    </Button>
  );
  if (mobile) {
    return (
      <>
        {button}
        <Sheet
          open={open}
          onOpenChange={onOpenChange}
          title="색 직접 선택"
          description="색을 고른 뒤 선택을 누르면 적용돼요."
          leadingAction={() => cancelButton}
          action={confirmButton}
          overlayClassName="z-82"
          className="z-83 rounded-t-[var(--sp-6)]"
          onCloseAutoFocus={restoreFocus}
          odId="sheet-category-color"
        >
          {content}
        </Sheet>
      </>
    );
  }
  return (
    <Popover.Root modal open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{button}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label="색 직접 선택"
          align="end"
          side="bottom"
          avoidCollisions={false}
          sideOffset={8}
          onCloseAutoFocus={restoreFocus}
          className={cn(
            "z-83 max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto",
            "rounded-[var(--r-dialog)] bg-background p-4 text-foreground shadow-[var(--shadow-sheet)]",
          )}
          data-od-id="popover-category-color"
        >
          <header className="flex min-h-11 items-center justify-between gap-3">
            {cancelButton}
            <h2 className="text-headline">색 직접 선택</h2>
            {confirmButton}
          </header>
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default EventCategoryCustomColorPicker;
