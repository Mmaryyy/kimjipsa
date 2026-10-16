"use client";
import { useCallback, useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/entities/user";
import {
  LegalDocumentContent,
  legalDocumentTitles,
  type LegalDocumentKind,
} from "@/entities/legal-document";
import { ApiError } from "@/shared/api";
import {
  Button,
  Checkbox,
  FormFieldRow,
  Sheet,
  Text,
  TextButton,
} from "@/shared/ui";
import { useProfileForm } from "../model/use-account";
function LegalDocumentSheet({ kind }: { kind: LegalDocumentKind }) {
  const [open, setOpen] = useState(false);
  const label = kind === "terms" ? "이용약관 보기" : "개인정보 처리방침 보기";
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={legalDocumentTitles[kind]}
      description="개발용 초안의 내용을 확인해 주세요."
      trigger={
        <TextButton aria-label={label} size="sm">
          보기
        </TextButton>
      }
    >
      <LegalDocumentContent kind={kind} />
    </Sheet>
  );
}

function ConsentFields({
  control,
  error,
}: {
  control: Control<ProfileInput>;
  error?: string;
}) {
  return (
    <fieldset
      className="grid gap-3"
      aria-describedby={error ? "consent-error" : undefined}
    >
      <legend className="mb-3 text-label">필수 동의</legend>
      <Text as="p" variant="caption" className="text-muted-foreground">
        아래 문서는 개발용 초안이에요. 정식 문서는 베타 전에 안내해요.
      </Text>
      <div className="flex items-center gap-2">
        <Controller
          name="termsAccepted"
          control={control}
          render={({ field, fieldState }) => (
            <Checkbox
              id="termsAccepted"
              name={field.name}
              ref={field.ref}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={error ? "consent-error" : undefined}
              required
            />
          )}
        />
        <label htmlFor="termsAccepted">이용약관 동의</label>
        <LegalDocumentSheet kind="terms" />
      </div>
      <div className="flex items-center gap-2">
        <Controller
          name="privacyAccepted"
          control={control}
          render={({ field, fieldState }) => (
            <Checkbox
              id="privacyAccepted"
              name={field.name}
              ref={field.ref}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={error ? "consent-error" : undefined}
              required
            />
          )}
        />
        <label htmlFor="privacyAccepted">개인정보 처리방침 동의</label>
        <LegalDocumentSheet kind="privacy" />
      </div>
      {error && (
        <Text
          as="p"
          id="consent-error"
          role="alert"
          className="text-error-text"
        >
          {error}
        </Text>
      )}
    </fieldset>
  );
}
export function ProfileForm({
  displayName,
  onSaved,
}: {
  displayName?: string;
  onSaved?: () => void;
}) {
  const hasProfile = displayName !== undefined;
  const { onSubmit, saved } = useProfileForm(onSaved);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: displayName ?? "",
      termsAccepted: hasProfile,
      privacyAccepted: hasProfile,
    },
  });
  const onSave = useCallback(
    async (input: ProfileInput) => {
      try {
        await onSubmit(input);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "server";
        const message =
          error instanceof Error
            ? error.message
            : "저장하지 못했어요. 다시 시도해 주세요.";
        let field: "displayName" | "termsAccepted" | "root.server" =
          "root.server";
        if (code.startsWith("display_name_")) field = "displayName";
        if (code === "consent_required" && !hasProfile) field = "termsAccepted";
        setError(field, { type: code, message });
      }
    },
    [onSubmit, setError, hasProfile],
  );
  const nameError = errors.displayName?.message;
  const consentError =
    errors.termsAccepted?.message ?? errors.privacyAccepted?.message;
  const formError = errors.root?.server?.message;
  return (
    <form
      onSubmit={handleSubmit(onSave)}
      noValidate
      className="grid gap-5"
      aria-busy={isSubmitting}
    >
      <FormFieldRow
        label="표시 이름"
        htmlFor="displayName"
        invalid={Boolean(nameError)}
        error={nameError}
      >
        {(controlProps) => (
          <input
            {...controlProps}
            aria-describedby={[
              controlProps["aria-describedby"],
              "displayName-hint",
            ]
              .filter(Boolean)
              .join(" ")}
            className="kj-input"
            {...register("displayName")}
            required
            autoComplete="nickname"
            placeholder="어떻게 불러 드릴까요?"
          />
        )}
      </FormFieldRow>
      <Text
        as="p"
        id="displayName-hint"
        variant="caption"
        className="text-muted-foreground"
      >
        표시 이름은 6자 이하로 입력해 주세요.
      </Text>
      {!hasProfile && <ConsentFields control={control} error={consentError} />}
      {formError && (
        <Text as="p" role="alert" className="text-error-text">
          {formError}
        </Text>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "저장하고 있어요" : "저장하고 계속하기"}
      </Button>
      {saved && (
        <Text as="p" role="status">
          표시 이름을 저장했어요.
        </Text>
      )}
    </form>
  );
}
