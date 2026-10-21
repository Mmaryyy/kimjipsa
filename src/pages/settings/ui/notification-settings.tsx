"use client";
import { NotificationSettingsSkeleton } from "./settings-skeleton";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  notificationSettingsSchema,
  useNotificationSettings,
  useSaveNotificationSettings,
  type NotificationSettings as Settings,
} from "@/entities/user";
import {
  Input,
  ErrorState,
  FormFieldRow,
  GroupLabel,
  Switch,
  Toast,
  Text,
} from "@/shared/ui";
function NotificationSettingsForm({ settings }: { settings: Settings }) {
  const save = useSaveNotificationSettings();
  const savedSettings = useRef(settings);
  const saveQueue = useRef(Promise.resolve());
  const [toastOpen, setToastOpen] = useState(false);
  const [message, setMessage] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Settings>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: settings,
  });
  const onSubmit = useCallback(
    async (values: Settings) => {
      setToastOpen(false);
      const persist = async () => {
        const previous = savedSettings.current;
        try {
          await save.mutateAsync(values);
          savedSettings.current = values;
          setMessage(
            previous.pushEnabled !== values.pushEnabled
              ? values.pushEnabled
                ? "알림을 켰어요"
                : "알림을 껐어요"
              : "알림 설정을 저장했어요",
          );
        } catch (error) {
          reset(savedSettings.current);
          setMessage(
            error instanceof Error ? error.message : "저장하지 못했어요.",
          );
        } finally {
          setToastOpen(true);
        }
      };
      saveQueue.current = saveQueue.current.then(persist);
      await saveQueue.current;
    },
    [reset, save],
  );
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <fieldset aria-busy={save.isPending} className="grid min-w-0 gap-2">
        <legend className="sr-only">알림 설정</legend>
        <FormFieldRow label="웹 푸시 알림" htmlFor="s-push">
          {(props) => (
            <Controller
              name="pushEnabled"
              control={control}
              render={({ field }) => (
                <Switch
                  {...props}
                  data-od-id="s-push"
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
        <FormFieldRow
          label="아침 요약"
          htmlFor="s-morning-time"
          invalid={!!errors.morningSummaryTime}
          error={errors.morningSummaryTime?.message}
        >
          {(props) => (
            <Controller
              name="morningSummaryTime"
              control={control}
              render={({ field }) => (
                <div className="w-35">
                  <Input
                    {...props}
                    {...field}
                    type="time"
                    data-od-id="s-morning-time"
                    onBlur={() => {
                      field.onBlur();
                      void handleSubmit(onSubmit)();
                    }}
                  />
                </div>
              )}
            />
          )}
        </FormFieldRow>
        <Text as="p" variant="caption" className="text-muted-foreground">
          iPhone에서는 Safari 공유 메뉴에서 ‘홈 화면에 추가’를 해야 알림을 받을
          수 있어요.
        </Text>
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
export function NotificationSettings() {
  const settings = useNotificationSettings();
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
  else if (settings.isPending) content = <NotificationSettingsSkeleton />;
  else content = <NotificationSettingsForm settings={settings.data} />;
  return (
    <section
      data-od-id="set-notify"
      aria-labelledby="notification-settings-title"
    >
      <GroupLabel id="notification-settings-title">알림</GroupLabel>
      {content}
    </section>
  );
}
