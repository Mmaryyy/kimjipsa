import { cva, type VariantProps } from "class-variance-authority";

export const textStyles = cva("[overflow-wrap:anywhere]", {
  variants: {
    variant: {
      "title-lg": "text-title-lg",
      title: "text-title",
      "title-sm": "text-title-sm",
      headline: "text-headline",
      "body-lg": "text-body-lg",
      body: "text-body",
      "body-sm": "text-body-sm",
      label: "text-label",
      caption: "text-caption",
      "caption-sm": "text-caption-sm",
      "caption-xs": "text-caption-xs",
    },
  },
  defaultVariants: { variant: "body" },
});

export type TextVariant = NonNullable<
  VariantProps<typeof textStyles>["variant"]
>;

export const statusBadgeStyles = cva(
  [
    "inline-flex flex-none items-center gap-1 whitespace-nowrap",
    "text-[length:var(--type-caption-size)]",
  ],
  {
    variants: {
      variant: {
        success: "text-success-text [--status-dot:var(--success)]",
        info: "text-info-text [--status-dot:var(--info)]",
        warning: "text-warning-text [--status-dot:var(--warning)]",
        expiring:
          "text-status-expiring-text [--status-dot:var(--status-expiring)]",
        error: "text-error-text [--status-dot:var(--error)]",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export type StatusBadgeVariant = NonNullable<
  VariantProps<typeof statusBadgeStyles>["variant"]
>;

export type StatusVariant = Exclude<StatusBadgeVariant, "expiring">;

export const bannerStyles = cva(
  "flex items-start gap-3 p-3 [&_strong]:font-semibold text-caption",
  {
    variants: {
      variant: {
        success: "bg-success-soft",
        info: "bg-info-soft",
        warning: "bg-warning-soft",
        error: "bg-error-soft",
      } satisfies Record<StatusVariant, string>,
    },
    defaultVariants: { variant: "info" },
  },
);

export const buttonStyles = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm px-3",
    "whitespace-nowrap [word-break:keep-all] active:opacity-70 disabled:cursor-default",
    "disabled:[&_svg]:text-[var(--icon-tertiary)] kj-hit text-label",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        gray: "bg-muted text-foreground",
        toast:
          "bg-transparent px-0 font-semibold text-inherit tracking-normal underline",
        danger: "bg-muted text-destructive",
        success: "bg-success-button-bg text-success-button-fg",
        info: "bg-info-button-bg text-info-button-fg",
        warning: "bg-warning-button-bg text-warning-button-fg",
        error: "bg-error-button-bg text-error-button-fg",
      },
      size: {
        icon: "size-11 p-0",
        sm: "min-h-[var(--ctl-h-sm)] text-caption",
        md: "min-h-[var(--ctl-h)]",
        block: "min-h-[var(--ctl-h-lg)] w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export const textButtonStyles = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap",
    "[word-break:keep-all] active:opacity-70 disabled:cursor-default kj-hit text-label",
  ],
  {
    variants: {
      tone: { default: "text-primary", danger: "text-destructive" },
      size: {
        sm: "min-h-[var(--ctl-h-sm)] text-[length:var(--type-caption-size)]",
        md: "min-h-[var(--ctl-h)]",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

export const toggleGroupStyles = cva(
  [
    "flex min-w-0 [&_button]:cursor-pointer [&_button]:whitespace-nowrap",
    "[&_button]:[word-break:keep-all] [&_button:disabled]:cursor-default",
    "[&_button:disabled]:opacity-50",
  ],
  {
    variants: {
      appearance: {
        segmented: [
          "min-w-max shrink-0 rounded-sm bg-muted p-0.5 [&_button]:min-h-[var(--ctl-h-xs)]",
          "[&_button]:min-w-max [&_button]:flex-[1_0_auto] [&_button]:rounded-sm [&_button]:px-2",
          "[&_button[data-state=on]]:bg-[var(--control-selected-bg)]",
          "[&_button[data-state=on]]:font-semibold",
          "[&_button[data-state=on]]:shadow-[var(--shadow-control)]",
        ],
        filters: [
          "gap-5 overflow-x-auto py-2 [scrollbar-width:none] [&_button]:min-h-[var(--ctl-h)]",
          "[&_button]:flex-none [&_button]:text-[var(--label-tertiary)]",
          "[&_button[data-state=on]]:font-semibold [&_button[data-state=on]]:text-foreground",
          "[&_button[data-state=on]]:underline",
          "[&_button[data-state=on]]:underline-offset-[var(--sp-2)]",
        ],
      },
    },
    defaultVariants: { appearance: "segmented" },
  },
);

export const formFieldRowStyles = cva(
  [
    "flex min-h-[var(--row-min)] flex-wrap items-center gap-3 py-1 [&>label]:basis-22",
    "[&>label]:grow-0 [&>label]:shrink-0",
  ],
  {
    variants: { invalid: { true: "[&>label]:text-destructive", false: "" } },
  },
);

export const emptyStateStyles = cva("text-muted-foreground", {
  variants: {
    layout: {
      centered: "py-10 text-center",
      row: [
        "flex items-center justify-between gap-3 py-3 text-left [&>p]:text-muted-foreground",
        "[&>div:last-child]:mt-0 [&>div:last-child]:flex-none",
      ],
    },
  },
  defaultVariants: { layout: "centered" },
});
