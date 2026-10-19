"use client";
import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { familySchema } from "@/entities/family";
import { ApiError } from "@/shared/api";
import { Button, CategoryDot, FormFieldRow, Text } from "@/shared/ui";
import { useCreateFamily } from "../model/use-family";
export function CreateFamilyForm({ onCreated }: { onCreated?: () => void }) {
  const { onSubmit } = useCreateFamily(onCreated);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string }>({
    resolver: zodResolver(familySchema),
    defaultValues: { name: "" },
  });
  const onCreate = useCallback(
    async ({ name }: { name: string }) => {
      try {
        await onSubmit(name);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "server";
        const message =
          error instanceof Error
            ? error.message
            : "가정을 만들지 못했어요. 다시 시도해 주세요.";
        const field =
          code.startsWith("family_name_") || code === "validation_failed"
            ? "name"
            : "root.server";
        setError(field, { type: code, message });
      }
    },
    [onSubmit, setError],
  );
  const name = useWatch({ control, name: "name" });
  const nameError = errors.name?.message;
  const formError = errors.root?.server?.message;
  return (
    <form
      onSubmit={handleSubmit(onCreate)}
      noValidate
      className={onCreated ? "kj-onboarding-form" : "grid gap-5"}
      aria-busy={isSubmitting}
    >
      <FormFieldRow
        className={onCreated ? "kj-family-name-field" : undefined}
        label="가정 이름"
        htmlFor="familyName"
        invalid={Boolean(nameError)}
        error={nameError}
      >
        {(controlProps) => (
          <input
            {...controlProps}
            aria-describedby={[
              controlProps["aria-describedby"],
              "familyName-hint",
            ]
              .filter(Boolean)
              .join(" ")}
            data-od-id="ob-home-name"
            className="kj-input text-title"
            {...register("name")}
            required
            placeholder="도토리네"
            autoComplete="off"
          />
        )}
      </FormFieldRow>
      <Text
        as="p"
        id="familyName-hint"
        variant="caption"
        className="text-muted-foreground"
      >
        가정 이름은 10자 이하로 입력해 주세요.
      </Text>
      <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
        <CategoryDot />
        {name.trim() || "도토리네"}
        <span>· 일정 카테고리</span>
      </div>
      {formError && (
        <Text as="p" role="alert" className="text-error-text">
          {formError}
        </Text>
      )}
      <Button data-od-id="ob-home-create" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "우리 집을 만들고 있어요" : "우리 집 만들기"}
      </Button>
    </form>
  );
}
