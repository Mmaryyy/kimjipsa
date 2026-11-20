"use client";

import type { VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import {
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
  tone,
  heading: Heading = "h3",
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger> &
  VariantProps<typeof accordionTriggerStyles> & { heading?: "h2" | "h3" }) => (
  <AccordionPrimitive.Header asChild>
    <Heading>
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(accordionTriggerStyles({ tone }), className)}
        {...props}
      >
        <ChevronDown aria-hidden="true" strokeLinecap="round" />
        {children}
      </AccordionPrimitive.Trigger>
    </Heading>
  </AccordionPrimitive.Header>
);

const AccordionContent = ({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) => (
  <AccordionPrimitive.Content
    data-slot="accordion-content"
    className={cn(accordionContentStyles(), className)}
    {...props}
  />
);

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
