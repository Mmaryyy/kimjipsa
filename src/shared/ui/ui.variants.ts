import { cva, type VariantProps } from "class-variance-authority";

export const textStyles = cva("kj-text", {
  variants: {
    variant: {
      display: "text-display",
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

export const statusBadgeStyles = cva("kj-status-badge", {
  variants: {
    variant: {
      success: "text-success-text [--status-dot:var(--success)]",
      info: "text-info-text [--status-dot:var(--info)]",
      warning: "text-warning-text [--status-dot:var(--warning)]",
      error: "text-error-text [--status-dot:var(--error)]",
    },
  },
  defaultVariants: { variant: "info" },
});

export type StatusVariant = NonNullable<
  VariantProps<typeof statusBadgeStyles>["variant"]
>;

export const bannerStyles = cva("kj-banner text-caption", {
  variants: {
    variant: {
      success: "bg-success-soft",
      info: "bg-info-soft",
      warning: "bg-warning-soft",
      error: "bg-error-soft",
    } satisfies Record<StatusVariant, string>,
  },
  defaultVariants: { variant: "info" },
});

export const buttonStyles = cva("kj-button kj-hit text-label", {
  variants: {
    variant: {
      primary: "bg-primary text-primary-foreground",
      gray: "bg-muted text-foreground",
      danger: "bg-muted text-destructive",
      success: "bg-success-button-bg text-success-button-fg",
      info: "bg-info-button-bg text-info-button-fg",
      warning: "bg-warning-button-bg text-warning-button-fg",
      error: "bg-error-button-bg text-error-button-fg",
    },
    size: {
      sm: "kj-control-sm text-caption",
      md: "kj-control-md",
      block: "kj-control-block",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export const textButtonStyles = cva("kj-text-button kj-hit text-label", {
  variants: {
    tone: { default: "text-primary", danger: "text-destructive" },
    size: { sm: "kj-control-sm text-caption", md: "kj-control-md" },
  },
  defaultVariants: { tone: "default", size: "md" },
});

export const toggleGroupStyles = cva("kj-toggle-group", {
  variants: {
    appearance: {
      segmented: "kj-segmented-control",
      filters: "kj-filter-tabs",
    },
  },
  defaultVariants: { appearance: "segmented" },
});

export const formFieldRowStyles = cva("kj-form-field-row", {
  variants: { invalid: { true: "kj-form-field-row-invalid", false: "" } },
});
