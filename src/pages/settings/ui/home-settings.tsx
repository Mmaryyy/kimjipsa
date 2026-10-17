"use client";
import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { calendarViews } from "@/entities/event";
import {
  homeSettingsSchema,
  useHomeSettings,
  useSaveHomeSettings,
  type HomeSettings as Settings,
} from "@/entities/user";
import {
  Button,
  ErrorState,
  FormFieldRow,
  ListSkeleton,
  SectionHeader,
  Switch,
  Text,
} from "@/shared/ui";
function HomeSettingsForm({ settings }: { settings: Settings }) {
  const save = useSaveHomeSettings();
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<Settings>({
    resolver: zodResolver(homeSettingsSchema),
    defaultValues: settings,
  });
  const onSubmit = useCallback(
    async (values: Settings) => {
      try {
        await save.mutateAsync(values);
        reset(values);
      } catch (error) {
        setError("root", {
          message:
            error instanceof Error ? error.message : "저장하지 못했어요.",
        });
      }
    },
    [reset, save, setError],
  );
  return (
    <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-2">
        <legend className="sr-only">홈 구성</legend>
        <FormFieldRow
          label="달력 보기"
          htmlFor="home-view"
          error={errors.homeView?.message}
          invalid={!!errors.homeView}
        >
          {(props) => (
            <select {...props} {...register("homeView")}>
              {calendarViews.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </FormFieldRow>
        <FormFieldRow label="다가오는 일정" htmlFor="upcoming-enabled">
          {(props) => (
            <Controller
              name="upcomingEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  {...props}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          )}
        </FormFieldRow>
        <FormFieldRow
          label="일정 개수"
          htmlFor="upcoming-count"
          error={errors.upcomingCount?.message}
          invalid={!!errors.upcomingCount}
        >
          {(props) => (
            <select
              {...props}
              {...register("upcomingCount", { valueAsNumber: true })}
            >
              {[3, 5, 10].map((count) => (
                <option key={count} value={count}>
                  {count}개
                </option>
              ))}
            </select>
          )}
        </FormFieldRow>
      </fieldset>
      {errors.root && (
        <Text as="p" role="alert" className="text-error-text">
          {errors.root.message}
        </Text>
      )}
      {save.isSuccess && !isDirty && (
        <Text as="p" role="status">
          홈 구성을 저장했어요.
        </Text>
      )}
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "저장하고 있어요" : "홈 구성 저장하기"}
      </Button>
    </form>
  );
}
export function HomeSettings() {
  const settings = useHomeSettings();
  let content;
  if (settings.isError)
    content = (
      <ErrorState
        message={settings.error.message}
        onRetry={() => {
          void settings.refetch();
        }}
      />
    );
  else if (settings.isPending)
    content = <ListSkeleton label="홈 설정을 불러오고 있어요" />;
  else content = <HomeSettingsForm settings={settings.data} />;
  return (
    <section aria-labelledby="home-settings-title">
      <SectionHeader id="home-settings-title" title="홈 구성" />
      {content}
    </section>
  );
}
