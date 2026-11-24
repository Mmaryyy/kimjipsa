"use client";

import type { VariantProps } from "class-variance-authority";
import { ChevronDown, Ellipsis } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/shared/lib";
import {
  accordionContentBodyStyles,
  accordionContentStyles,
  accordionItemStyles,
  accordionTriggerStyles,
} from "../ui.variants";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = ({
  className,
  variant,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item> &
  VariantProps<typeof accordionItemStyles>) => (
  <AccordionPrimitive.Item
    data-slot="accordion-item"
    className={cn(accordionItemStyles({ variant }), className)}
    {...props}
  />
);

const AccordionTrigger = ({
  className,
  children,
  size,
  tone,
  indicator,
  heading: Heading = "h3",
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger> &
  VariantProps<typeof accordionTriggerStyles> & {
    heading?: "h2" | "h3" | "h4";
  }) => (
  <AccordionPrimitive.Header asChild>
    <Heading>
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          accordionTriggerStyles({ size, tone, indicator }),
          className,
        )}
        {...props}
      >
        {indicator === "ellipsis" ? (
          <Ellipsis aria-hidden="true" />
        ) : (
          <ChevronDown aria-hidden="true" strokeLinecap="round" />
        )}
        {children}
      </AccordionPrimitive.Trigger>
    </Heading>
  </AccordionPrimitive.Header>
);

const AccordionContent = ({
  children,
  className,
  leading,
  variant,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content> &
  VariantProps<typeof accordionContentBodyStyles> & {
    leading?: ReactNode;
  }) => (
  <AccordionPrimitive.Content
    data-slot="accordion-content"
    className={cn(accordionContentStyles(), className)}
    {...props}
  >
    {leading}
    {variant ? (
      <div className={accordionContentBodyStyles({ variant })}>{children}</div>
    ) : (
      children
    )}
  </AccordionPrimitive.Content>
);

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
