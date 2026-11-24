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
    tone: {
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { variant: "body" },
});

export type TextVariant = NonNullable<
  VariantProps<typeof textStyles>["variant"]
>;

export const statusBadgeStyles = cva(
  "inline-flex flex-none items-center gap-1 whitespace-nowrap text-[length:var(--type-caption-size)]",
  {
    variants: {
      variant: {
        success: "text-success-text [--status-dot:var(--success)]",
        info: "text-info-text [--status-dot:var(--info)]",
        warning: "text-warning-text [--status-dot:var(--warning)]",
        expiring:
          "text-status-expiring-text [--status-dot:var(--status-expiring)]",
        error: "text-error-text [--status-dot:var(--error)]",
        progress: "text-sys-cyan-ic [--status-dot:var(--sys-cyan)]",
        neutral: [
          "text-label-secondary [--status-dot:var(--sys-gray)]",
          "[--status-border:var(--sys-gray3)]",
        ],
      },
      shape: {
        capsule:
          "h-5.5 rounded-full border border-[color:var(--status-border,var(--status-dot))] px-2",
        pill: [
          "rounded-full bg-muted px-1.5",
          "text-[length:var(--type-caption-xs-size)] leading-[var(--type-caption-xs-lh)]",
        ],
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export type StatusBadgeVariants = VariantProps<typeof statusBadgeStyles>;

export type StatusVariant = Exclude<
  NonNullable<StatusBadgeVariants["variant"]>,
  "expiring" | "progress" | "neutral"
>;

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

// Keep the focus outline inside fields that sit against an overflow boundary.
const fieldFocusStyles = "focus-visible:-outline-offset-2";
export const compactFieldStyles = "py-2 text-body-sm leading-[1.4]";

export const inputStyles = cva(["min-w-0", fieldFocusStyles], {
  variants: {
    variant: {
      default:
        "w-full min-h-[var(--hit)] rounded-sm border-0 bg-muted px-3 py-2 text-foreground",
      inline:
        "w-full min-h-[var(--hit)] rounded-sm border-0 bg-transparent py-2 text-right text-foreground",
      compact: [
        "w-full rounded-sm border-0 bg-muted px-3 text-foreground",
        compactFieldStyles,
      ],
      glass:
        "glass-surface kj-field-focus relative flex min-h-[var(--hit)] items-center gap-2 px-3",
    },
  },
  defaultVariants: { variant: "default" },
});

export const textareaStyles = cva(
  "min-h-hit w-full min-w-0 rounded-sm border-0 py-2 text-foreground disabled:cursor-default",
  {
    variants: {
      variant: {
        default: "bg-muted px-3",
        inline: "resize-none overflow-y-auto bg-transparent px-0",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const buttonStyles = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm px-3",
    "whitespace-nowrap [word-break:keep-all] active:opacity-70 disabled:cursor-default disabled:opacity-50",
    "disabled:[&_svg]:text-[var(--icon-tertiary)] kj-hit text-label",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        glass:
          "glass-surface relative rounded-[var(--r-round)] px-4 text-primary active:opacity-100",
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
        "icon-sm": "size-8 rounded-full p-0 [&_svg]:size-4",
        sm: "min-h-[var(--ctl-h-sm)] text-caption",
        touch: "min-h-[var(--hit)] min-w-[var(--hit)]",
        md: "min-h-[var(--ctl-h)]",
        block: "min-h-[var(--ctl-h-lg)] w-full",
      },
    },
    compoundVariants: [
      {
        variant: "glass",
        size: "icon",
        className: "h-[var(--hit)] min-h-[var(--hit)]",
      },
      {
        variant: "glass",
        size: ["sm", "md", "block"],
        className: [
          "h-[var(--hit)] min-h-[var(--hit)] px-4",
          "text-[length:var(--type-label-size)] font-semibold text-muted-foreground",
        ],
      },
    ],
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
      tone: {
        default: "text-primary",
        danger: "text-destructive",
        neutral: "text-foreground",
        muted: "text-muted-foreground [&_svg]:text-[var(--icon-secondary)]",
      },
      size: {
        icon: "size-11",
        sm: "min-h-[var(--ctl-h-sm)] text-[length:var(--type-caption-size)]",
        md: "min-h-[var(--ctl-h)]",
        touch: "min-h-[var(--hit)]",
        "row-start":
          "min-h-[var(--row-min)] w-full justify-start text-left font-normal",
      },
    },
    defaultVariants: { tone: "default", size: "md" },
  },
);

export const checkboxStyles = cva(
  [
    "group/checkbox grid size-5 flex-none cursor-pointer place-items-center",
    "rounded-[var(--r-round)] border-[length:calc(var(--sp-half)*0.75)]",
    "border-[var(--sys-gray3)] disabled:cursor-default disabled:opacity-50 kj-hit",
    "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
    "data-[state=indeterminate]:text-primary-foreground",
  ],
  {
    variants: {
      tone: {
        default: [
          "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
          "data-[state=checked]:text-primary-foreground",
        ],
        muted: [
          "data-[state=checked]:border-label-done data-[state=checked]:bg-label-done",
          "data-[state=checked]:bg-clip-padding data-[state=checked]:text-background",
        ],
      },
    },
    defaultVariants: { tone: "default" },
  },
);

export const listStyles = cva("m-0 list-none p-0", {
  variants: {
    variant: {
      divided: "divide-y divide-border",
    },
  },
});

export const listRowStyles = cva(
  "flex items-center gap-3 [overflow-wrap:anywhere]",
  {
    variants: {
      size: {
        default: "min-h-[var(--row-min)] py-2",
        compact: "min-h-[var(--hit)]",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export const accordionItemStyles = cva("", {
  variants: {
    variant: {
      default: "border-b last:border-b-0",
      plain: "border-0",
    },
  },
  defaultVariants: { variant: "default" },
});

export const accordionTriggerStyles = cva(
  [
    "flex min-h-11 w-full items-center gap-2 rounded-sm text-start font-normal",
    "disabled:cursor-default disabled:opacity-50",
    "[&>svg]:shrink-0",
  ],
  {
    variants: {
      size: {
        default: "py-3 text-headline [&>svg]:size-5",
        compact:
          "py-1 text-caption focus-visible:-outline-offset-2 [&>svg]:order-last [&>svg]:size-4",
      },
      tone: {
        default: "text-foreground",
        muted: "text-label-done",
      },
      indicator: {
        chevron: [
          "data-[state=open]:[&>svg]:rotate-180",
          "motion-safe:[&>svg]:transition-transform motion-safe:[&>svg]:duration-[var(--dur-fast)]",
        ],
        ellipsis: "[&>svg]:order-last",
      },
    },
    defaultVariants: { size: "default", tone: "default", indicator: "chevron" },
  },
);

export const accordionContentStyles = cva([
  "overflow-hidden",
  "motion-safe:data-[state=open]:animate-[accordion-expand_var(--dur-fast)_var(--ease)]",
  "motion-safe:data-[state=closed]:animate-[accordion-collapse_var(--dur-fast)_var(--ease)]",
]);

export const accordionContentBodyStyles = cva("", {
  variants: {
    variant: {
      card: "mb-2 rounded-[calc(var(--r-control)*2)] bg-fill-quaternary p-3",
    },
  },
});

export const segmentedStyles = cva(
  [
    "flex min-w-max shrink-0 rounded-sm bg-muted p-0.5",
    "[&>*]:min-w-max [&>*]:rounded-sm [&>*]:px-2 [&>*]:whitespace-nowrap [&>*]:[word-break:keep-all]",
    "[&>*:is([data-state=on],[aria-current=page])]:font-semibold",
  ],
  {
    variants: {
      mode: {
        control: [
          "[&_button]:min-h-ctl-h-xs [&_button]:flex-[1_0_auto]",
          "[&_button[data-state=on]]:bg-control-selected-bg",
          "[&>*[data-state=on]]:shadow-[var(--shadow-control)]",
        ],
        navigation: [
          "gap-1 [&>a]:flex [&>a]:min-h-ctl-h [&>a]:flex-1 [&>a]:items-center [&>a]:justify-center",
          "[&>a[aria-current=page]]:bg-accent-soft [&>a[aria-current=page]]:text-primary",
        ],
      },
    },
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
        segmented: segmentedStyles({ mode: "control" }),
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

export const selectStyles = cva(
  ["h-full w-full min-w-0 appearance-none truncate pr-8", fieldFocusStyles],
  {
    variants: {
      variant: {
        default: "min-h-11 rounded-sm bg-muted pl-3 text-base",
        row: "min-h-[var(--ctl-h)] bg-transparent text-right text-base",
        compact: ["rounded-sm bg-muted pl-2", compactFieldStyles],
        inline: "bg-transparent text-body-sm leading-[1.4]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const selectContainerStyles = cva(
  [
    "relative block max-w-full min-w-0",
    "[&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:right-3",
    "[&>svg]:top-1/2 [&>svg]:-translate-y-1/2 [&>svg]:text-muted-foreground",
  ],
  {
    variants: { inline: { true: "w-fit", false: "w-full" } },
    defaultVariants: { inline: false },
  },
);

export const formFieldRowStyles = cva("", {
  variants: {
    layout: {
      inline: "",
      stacked: "grid min-w-0 content-start gap-1",
    },
    density: {
      default: "",
      compact: "",
    },
    invalid: { true: "[&>label]:text-destructive", false: "" },
  },
  compoundVariants: [
    {
      layout: "inline",
      density: "default",
      class: [
        "flex min-h-[var(--row-min)] flex-wrap items-center gap-3 py-1",
        "[&>label]:basis-22 [&>label]:grow-0 [&>label]:shrink-0",
      ],
    },
    {
      layout: "inline",
      density: "compact",
      class: [
        "grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-2",
        "[&>label]:whitespace-nowrap [&>[role=alert]]:col-start-2",
      ],
    },
  ],
  defaultVariants: { layout: "inline", density: "default" },
});

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
