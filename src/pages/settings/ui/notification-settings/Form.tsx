"use client";
import { useWebPush } from "../../model/use-web-push";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  notificationSettingsSchema,
  useSaveNotificationSettings,
  type NotificationSettings as Settings,
} from "@/entities/user";
import { FormFieldRow, Switch, Toast, Text, TextButton } from "@/shared/ui";
import { DateTimeInput, todayInSeoul } from "@/shared/ui/date-time-input";

interface Props {
  settings: Settings;
}

const NotificationSettingsForm = ({ settings }: Props) => {
  const save = useSaveNotificationSettings();
  const push = useWebPush();
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
      const persist = async () => {
        const previous = savedSettings.current;
        if (
          values.pushEnabled === previous.pushEnabled &&
          values.morningSummaryTime === previous.morningSummaryTime
        )
          return;
        setToastOpen(false);
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
  const pushEnabled = useWatch({ control, name: "pushEnabled" });
  const showPushError = useCallback((error: unknown) => {
    setMessage(
      error instanceof Error ? error.message : "푸시 설정을 바꾸지 못했어요.",
    );
    setToastOpen(true);
  }, []);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <fieldset
        aria-busy={save.isPending || push.checking}
        className="grid min-w-0 gap-2"
      >
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
                  disabled={save.isPending}
                  onCheckedChange={(value) => {
                    field.onChange(value);
                    void handleSubmit(onSubmit)();
                  }}
                />
              )}
            />
          )}
        </FormFieldRow>
        <Text as="p" variant="caption" className="text-muted-foreground">
          모든 기기에 함께 적용돼요. 켜면 구독된 모든 기기에서 알림을 받아요.
        </Text>
        {pushEnabled && !push.subscribed && !push.checking && (
          <div>
            <TextButton
              disabled={push.pending}
              onClick={() => void push.onConnect().catch(showPushError)}
            >
              이 기기에서 받기
            </TextButton>
          </div>
        )}
        {push.failure && (
          <div>
            <Text
              as="p"
              variant="caption"
              role="alert"
              className="text-error-text"
            >
              {push.failure}
            </Text>
            <TextButton onClick={() => void push.onRetry()}>
              다시 확인
            </TextButton>
          </div>
        )}
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
                <DateTimeInput
                  label="아침 요약"
                  controlProps={props}
                  pickerOdId="s-morning-time"
                  timeOnly
                  singleDate
                  range={{
                    startDate: todayInSeoul(),
                    endDate: todayInSeoul(),
                    startTime: field.value,
                    endTime: field.value,
                  }}
                  onConfirm={(range) => {
                    field.onChange(range.startTime);
                    field.onBlur();
                    void handleSubmit(onSubmit)();
                  }}
                />
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
};

export default NotificationSettingsForm;
