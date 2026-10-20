"use client";
import { useCallback, useRef, useState } from "react";
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
  ErrorState,
  FormFieldRow,
  ListSkeleton,
  GroupLabel,
  SegmentedControl,
  Switch,
  Toast,
} from "@/shared/ui";
function HomeSettingsForm({ settings }: { settings: Settings }) {
  const save = useSaveHomeSettings();
  const savedSettings = useRef(settings);
  const saving = useRef(false);
  const pendingSettings = useRef<Settings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [message, setMessage] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Settings>({
    resolver: zodResolver(homeSettingsSchema),
    defaultValues: settings,
  });
  const onSubmit = useCallback(
    async (values: Settings) => {
      pendingSettings.current = values;
      if (saving.current) return;
      saving.current = true;
      setIsSaving(true);
      setToastOpen(false);
      try {
        while (pendingSettings.current) {
          const nextSettings = pendingSettings.current;
          pendingSettings.current = null;
          try {
            await save.mutateAsync(nextSettings);
            savedSettings.current = nextSettings;
            setMessage("홈 구성을 저장했어요");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "저장하지 못했어요.",
            );
          }
          // A completed request must never overwrite a newer edit in the form.
          if (!pendingSettings.current) reset(savedSettings.current);
        }
      } finally {
        saving.current = false;
        setIsSaving(false);
        setToastOpen(true);
      }
    },
    [reset, save],
  );
  const upcomingEnabled = useWatch({ control, name: "upcomingEnabled" });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <fieldset aria-busy={isSaving} className="grid min-w-0 gap-2">
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
                  onValueChange={(value) => {
                    field.onChange(value);
                    void handleSubmit(onSubmit)();
                  }}
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
                  onCheckedChange={(value) => {
                    field.onChange(value);
                    void handleSubmit(onSubmit)();
                  }}
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
                    onValueChange={(value) => {
                      field.onChange(Number(value));
                      void handleSubmit(onSubmit)();
                    }}
                    {...props}
                  />
                )}
              />
            )}
          </FormFieldRow>
        )}
      </fieldset>
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        message={message}
        duration={2500}
      />
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
