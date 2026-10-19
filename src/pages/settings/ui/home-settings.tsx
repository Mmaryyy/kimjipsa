"use client";
import { useCallback } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
  GroupLabel,
  SegmentedControl,
  Switch,
  Text,
} from "@/shared/ui";
function HomeSettingsForm({ settings }: { settings: Settings }) {
  const save = useSaveHomeSettings();
  const {
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
  const upcomingEnabled = useWatch({ control, name: "upcomingEnabled" });
  return (
    <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-2">
        <legend className="sr-only">홈 구성</legend>
        <FormFieldRow
          label="캘린더 보기"
          htmlFor="home-view"
          error={errors.homeView?.message}
          invalid={!!errors.homeView}
        >
          {(props) => (
            <Controller
              name="homeView"
              control={control}
              render={({ field }) => (
                <SegmentedControl
                  odId="s-home-view"
                  label="홈 캘린더 보기"
                  options={calendarViews.map((option) => ({
                    ...option,
                    label: option.label.slice(0, 1),
                  }))}
                  value={field.value}
                  onValueChange={field.onChange}
                  {...props}
                />
              )}
            />
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
                  data-od-id="s-widget"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          )}
        </FormFieldRow>
        {upcomingEnabled && (
          <FormFieldRow
            label="표시 개수"
            htmlFor="upcoming-count"
            error={errors.upcomingCount?.message}
            invalid={!!errors.upcomingCount}
          >
            {(props) => (
              <Controller
                name="upcomingCount"
                control={control}
                render={({ field }) => (
                  <SegmentedControl
                    odId="s-widget-count"
                    label="표시 개수"
                    options={[3, 5, 10].map((count) => ({
                      value: String(count),
                      label: `${count}개`,
                    }))}
                    value={String(field.value)}
                    onValueChange={(value) => field.onChange(Number(value))}
                    {...props}
                  />
                )}
              />
            )}
          </FormFieldRow>
        )}
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
    <section data-od-id="set-home" aria-labelledby="home-settings-title">
      <GroupLabel id="home-settings-title">홈 화면</GroupLabel>
      {content}
    </section>
  );
}
