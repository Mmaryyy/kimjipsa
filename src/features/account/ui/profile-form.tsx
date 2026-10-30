"use client";
import { useCallback, useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/entities/user";
import {
  LegalDocumentContent,
  legalDocumentTitles,
  type LegalDocumentKind,
} from "@/entities/legal-document";
import { ApiError } from "@/shared/api";
import {
  Input,
  onboardingStyles,
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
      showCloseButton
      open={open}
      onOpenChange={setOpen}
      title={legalDocumentTitles[kind]}
      description="내용을 확인하고 동의해 주세요."
      trigger={
        <TextButton
          data-od-id={kind === "terms" ? "ob-terms-view" : "ob-privacy-view"}
          aria-label={label}
          size="sm"
        >
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
  setValue,
}: {
  control: Control<ProfileInput>;
  setValue: UseFormSetValue<ProfileInput>;
  error?: string;
}) {
  const terms = useWatch({ control, name: "termsAccepted" });
  const privacy = useWatch({ control, name: "privacyAccepted" });
  return (
    <fieldset
      className="grid gap-3"
      aria-describedby={error ? "consent-error" : undefined}
    >
      <legend className="sr-only">필수 동의</legend>
      <label className="flex items-center gap-3 font-semibold">
        <Checkbox
          data-od-id="ob-agree-all"
          checked={terms && privacy}
          onCheckedChange={(checked) => {
            setValue("termsAccepted", checked === true, { shouldDirty: true });
            setValue("privacyAccepted", checked === true, {
              shouldDirty: true,
            });
          }}
        />
        모두 동의
      </label>
      <Text as="p" variant="caption" className="text-muted-foreground">
        이용약관과 개인정보 처리방침을 확인해 주세요.
      </Text>
      <div className="flex items-center gap-2">
        <Controller
          name="termsAccepted"
          control={control}
          render={({ field, fieldState }) => (
            <Checkbox
              data-od-id="ob-agree-terms"
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
        <label htmlFor="termsAccepted">이용약관 동의 (필수)</label>
        <LegalDocumentSheet kind="terms" />
      </div>
      <div className="flex items-center gap-2">
        <Controller
          name="privacyAccepted"
          control={control}
          render={({ field, fieldState }) => (
            <Checkbox
              data-od-id="ob-agree-privacy"
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
        <label htmlFor="privacyAccepted">개인정보 처리방침 동의 (필수)</label>
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
  onboarding = false,
  autoFocus = false,
  reconsent = false,
}: {
  displayName?: string;
  onSaved?: () => void;
  onboarding?: boolean;
  autoFocus?: boolean;
  reconsent?: boolean;
}) {
  const hasProfile = displayName !== undefined;
  const { onSubmit, saved } = useProfileForm(onSaved);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: displayName ?? "",
      termsAccepted: hasProfile && !reconsent,
      privacyAccepted: hasProfile && !reconsent,
    },
  });
  const onSave = useCallback(
    async (input: ProfileInput) => {
      try {
        await onSubmit(
          hasProfile && !reconsent && !onboarding
            ? { displayName: input.displayName }
            : input,
        );
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "server";
        const message =
          error instanceof Error
            ? error.message
            : "저장하지 못했어요. 다시 시도해 주세요.";
        let field: "displayName" | "termsAccepted" | "root.server" =
          "root.server";
        if (code.startsWith("display_name_")) field = "displayName";
        if (code === "consent_required" && (!hasProfile || reconsent))
          field = "termsAccepted";
        setError(field, { type: code, message });
      }
    },
    [onSubmit, setError, hasProfile, reconsent, onboarding],
  );
  const termsAccepted = useWatch({ control, name: "termsAccepted" });
  const privacyAccepted = useWatch({ control, name: "privacyAccepted" });
  const consentMissing =
    (!hasProfile || onboarding || reconsent) &&
    (!termsAccepted || !privacyAccepted);
  const nameError = errors.displayName?.message;
  const consentError =
    errors.termsAccepted?.message ?? errors.privacyAccepted?.message;
  const formError = errors.root?.server?.message;
  return (
    <form
      onSubmit={handleSubmit(onSave)}
      noValidate
      className={onboarding ? onboardingStyles({ part: "form" }) : "grid gap-5"}
      aria-busy={isSubmitting}
    >
      <FormFieldRow
        label="표시 이름"
        htmlFor="displayName"
        invalid={Boolean(nameError)}
        error={nameError}
      >
        {(controlProps) => (
          <Input
            {...controlProps}
            aria-describedby={[
              controlProps["aria-describedby"],
              "displayName-hint",
            ]
              .filter(Boolean)
              .join(" ")}
            data-od-id={hasProfile ? "s-display-name-input" : undefined}
            autoFocus={autoFocus}
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
      {(!hasProfile || onboarding || reconsent) && (
        <ConsentFields
          control={control}
          error={consentError}
          setValue={setValue}
        />
      )}
      {formError && (
        <Text as="p" role="alert" className="text-error-text">
          {formError}
        </Text>
      )}
      {consentMissing && (
        <Text
          as="p"
          id="consent-hint"
          variant="caption"
          className="text-muted-foreground"
        >
          동의해야 계속할 수 있어요
        </Text>
      )}
      <Button
        data-od-id={!hasProfile || onboarding ? "ob-terms-next" : undefined}
        type="submit"
        disabled={isSubmitting || consentMissing}
        aria-describedby={consentMissing ? "consent-hint" : undefined}
      >
        {isSubmitting
          ? "저장하고 있어요"
          : hasProfile && !onboarding && !reconsent
            ? "표시 이름 저장"
            : "동의하고 계속"}
      </Button>
      {saved && (
        <Text as="p" role="status">
          표시 이름을 저장했어요.
        </Text>
      )}
    </form>
  );
}
