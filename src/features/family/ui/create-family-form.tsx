"use client";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { familySchema } from "@/entities/family";
import { ApiError } from "@/shared/api";
import { Button, FormFieldRow, Text } from "@/shared/ui";
import { useCreateFamily } from "../model/use-family";
export function CreateFamilyForm() {
  const { onSubmit } = useCreateFamily();
  const {
    register,
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
  const nameError = errors.name?.message;
  const formError = errors.root?.server?.message;
  return (
    <form
      onSubmit={handleSubmit(onCreate)}
      noValidate
      className="grid gap-5"
      aria-busy={isSubmitting}
    >
      <FormFieldRow
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
            className="kj-input"
            {...register("name")}
            required
            placeholder="예: 데비네"
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
      {formError && (
        <Text as="p" role="alert" className="text-error-text">
          {formError}
        </Text>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "우리 집을 만들고 있어요" : "우리 집 만들기"}
      </Button>
    </form>
  );
}
