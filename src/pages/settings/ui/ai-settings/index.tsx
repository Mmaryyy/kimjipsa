"use client";
import { useCallback, useRef, useState } from "react";
import {
  useAiSettings,
  useChat,
  type AiSettings as Settings,
} from "@/entities/chat-message";
import { useAccount } from "@/features/account";
import {
  Button,
  ConfirmDialog,
  GroupLabel,
  FormFieldRow,
  List,
  ListRow,
  Switch,
  StatusBadge,
  Toast,
  Input,
  Text,
  TextButton,
} from "@/shared/ui";
import SettingsRow from "../settings-row";

interface Props {
  settings: Settings;
  onSaved: () => void;
}
const AiSettingsForm = ({ settings, onSaved }: Props) => {
  const { save, memory } = useAiSettings();
  const account = useAccount();
  const chat = useChat(
    account.data?.membership?.familyId,
    account.data?.userId,
  );
  const saved = useRef({
    name: settings.name,
    memoryEnabled: settings.memoryEnabled,
  });
  const saving = useRef(false);
  const [nameError, setNameError] = useState("");
  const [name, setName] = useState(settings.name);
  const [memoryEnabled, setMemoryEnabled] = useState(settings.memoryEnabled);
  const [newMemory, setNewMemory] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reset, setReset] = useState(false);
  const admin = account.data?.membership?.role === "admin";
  const onSave = useCallback(
    async (nextName: string, nextMemoryEnabled: boolean) => {
      const values = {
        name: nextName.trim(),
        memoryEnabled: nextMemoryEnabled,
      };
      setNameError(values.name ? "" : "이름을 입력해 주세요.");
      if (
        !values.name ||
        saving.current ||
        (values.name === saved.current.name &&
          values.memoryEnabled === saved.current.memoryEnabled)
      )
        return;
      saving.current = true;
      try {
        await save.mutateAsync(values);
        saved.current = values;
        setName(values.name);
        onSaved();
      } catch {
        setName(saved.current.name);
        setMemoryEnabled(saved.current.memoryEnabled);
      } finally {
        saving.current = false;
      }
    },
    [onSaved, save],
  );
  return (
    <>
      <section data-od-id="set-ai" aria-label="AI 집사">
        <GroupLabel>AI 집사</GroupLabel>
        <form
          className="grid gap-3 text-foreground"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(name, memoryEnabled);
          }}
        >
          <fieldset
            disabled={!admin || save.isPending}
            className="grid min-w-0 gap-2"
          >
            <legend className="sr-only">AI 집사 설정</legend>
            <FormFieldRow
              label="이름"
              htmlFor="s-bot-name"
              invalid={!!nameError}
              error={nameError}
            >
              {(props) => (
                <span className="flex items-center gap-0.5">
                  <span className="text-muted-foreground">김</span>
                  <Input
                    {...props}
                    data-od-id="s-bot-name"
                    className="w-24! bg-transparent px-0 text-left!"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => void onSave(name, memoryEnabled)}
                    required
                    maxLength={20}
                  />
                </span>
              )}
            </FormFieldRow>
            <FormFieldRow
              label="앱의 가족 기억 사용하기"
              htmlFor="s-memory-toggle"
            >
              {(props) => (
                <Switch
                  {...props}
                  data-od-id="s-memory-toggle"
                  checked={memoryEnabled}
                  onCheckedChange={(checked) => {
                    setMemoryEnabled(checked);
                    void onSave(name, checked);
                  }}
                />
              )}
            </FormFieldRow>
            <Text as="p" variant="caption" className="text-muted-foreground">
              Hermes 자체 기억은 별도로 유지되며 Hermes에서 관리할 수 있어요.
            </Text>
          </fieldset>
          <SettingsRow
            label="맥미니"
            action={
              <span role="status">
                {chat.isError ? (
                  <TextButton onClick={() => void chat.refetch()}>
                    연결 확인 실패 · 다시 확인
                  </TextButton>
                ) : chat.data ? (
                  <StatusBadge
                    variant={chat.data.workerOnline ? "success" : "error"}
                  >
                    {chat.data.workerOnline ? "연결됨" : "끊김"}
                  </StatusBadge>
                ) : (
                  "연결 확인 중…"
                )}
              </span>
            }
          />
          {save.error && (
            <Text as="p" role="alert" className="text-error-text">
              {save.error.message}
            </Text>
          )}
        </form>
      </section>
      <section
        data-od-id="set-memory"
        aria-label="가족 기억"
        className="flex flex-col gap-3"
      >
        <GroupLabel>가족 기억</GroupLabel>
        {settings.memories.length === 0 && (
          <Text as="p" variant="caption" className="text-muted-foreground">
            저장한 가족 기억이 없어요.
          </Text>
        )}
        <List>
          {settings.memories.map((item) => (
            <ListRow
              key={item.id}
              trailing={
                <TextButton
                  disabled={memory.isPending}
                  tone="danger"
                  aria-label={`${item.text} 삭제하기`}
                  onClick={() =>
                    memory.mutate({
                      action: "delete-memory",
                      id: item.id,
                      version: item.version,
                    })
                  }
                >
                  삭제하기
                </TextButton>
              }
            >
              <FormFieldRow label="기억" htmlFor={`memory-${item.id}`}>
                {(props) => (
                  <Input
                    {...props}
                    aria-label="기억 내용"
                    className="w-full! bg-transparent px-0"
                    value={edits[item.id] ?? item.text}
                    disabled={memory.isPending}
                    onChange={(event) =>
                      setEdits((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const text = (edits[item.id] ?? item.text).trim();
                      if (text && text !== item.text)
                        memory.mutate({
                          action: "save-memory",
                          id: item.id,
                          version: item.version,
                          text,
                        });
                    }}
                    maxLength={2000}
                  />
                )}
              </FormFieldRow>
            </ListRow>
          ))}
        </List>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            memory.mutate(
              { action: "save-memory", text: newMemory },
              { onSuccess: () => setNewMemory("") },
            );
          }}
        >
          <FormFieldRow label="새 기억" htmlFor="new-family-memory">
            {(props) => (
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  {...props}
                  className="w-full! bg-transparent px-0"
                  aria-label="새 가족 기억"
                  value={newMemory}
                  maxLength={2000}
                  onChange={(event) => setNewMemory(event.target.value)}
                  placeholder="가족의 선호나 습관"
                />
                <TextButton
                  type="submit"
                  disabled={!newMemory.trim() || memory.isPending}
                >
                  추가
                </TextButton>
              </div>
            )}
          </FormFieldRow>
        </form>
        {settings.memories.length > 0 && (
          <TextButton tone="danger" onClick={() => setReset(true)}>
            기억 전체 초기화
          </TextButton>
        )}
        {memory.error && (
          <Text as="p" role="alert">
            {memory.error.message}
          </Text>
        )}
      </section>
      <ConfirmDialog
        open={reset}
        onOpenChange={setReset}
        title="가족 기억을 모두 지울까요?"
        description="앱의 가족 기억만 지워져요. Hermes 자체 기억은 유지돼요."
        pending={memory.isPending}
        onConfirm={() =>
          memory.mutate(
            { action: "reset-memories" },
            { onSuccess: () => setReset(false) },
          )
        }
      />
    </>
  );
};
const AiSettings = () => {
  const { query } = useAiSettings();
  const [toastOpen, setToastOpen] = useState(false);
  const onSaved = useCallback(() => setToastOpen(true), []);
  if (query.error)
    return (
      <section>
        <GroupLabel>AI 집사</GroupLabel>
        <Text as="p" role="alert">
          {query.error.message}
        </Text>
        <Button variant="gray" onClick={() => void query.refetch()}>
          다시 불러오기
        </Button>
      </section>
    );
  if (!query.data)
    return (
      <section>
        <GroupLabel>AI 집사</GroupLabel>
        <Text as="p" role="status">
          설정을 불러오는 중…
        </Text>
      </section>
    );
  return (
    <>
      <AiSettingsForm
        key={`${query.data.version}:${query.data.memoryVersion}`}
        settings={query.data}
        onSaved={onSaved}
      />
      <Toast
        open={toastOpen}
        onOpenChange={setToastOpen}
        message="집사 설정을 저장했어요"
        duration={2500}
      />
    </>
  );
};
export default AiSettings;
