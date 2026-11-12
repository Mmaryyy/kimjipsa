"use client";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  useAiSettings,
  useChat,
  type AiSettings as Settings,
} from "@/entities/chat-message";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib";
import { botTypeOptions } from "@/entities/user";
import {
  useAccount,
  useBotCharacter,
  useSaveBotType,
} from "@/features/account";
import {
  FormSheet,
  SegmentedControl,
  Button,
  useConfirm,
  useConfirmDisabled,
  GroupLabel,
  FormFieldRow,
  List,
  ListRow,
  Switch,
  StatusBadge,
  Toast,
  Input,
  Textarea,
  Text,
  TextButton,
} from "@/shared/ui";
import SettingsRow from "../settings-row";
import AiSettingsSkeleton from "./Skeleton";

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

interface Props {
  settings: Settings;
  onSaved: () => void;
}
const AiSettingsForm = ({ settings, onSaved }: Props) => {
  const { save, memory } = useAiSettings();
  const account = useAccount();
  const character = useBotCharacter();
  const typeSave = useSaveBotType();
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
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [editor, setEditor] = useState<
    Settings["memories"][number] | "new" | null
  >(null);
  const [memoryText, setMemoryText] = useState("");
  const [editingMemory, setEditingMemory] = useState(false);
  const confirm = useConfirm();
  const opener = useRef<HTMLButtonElement | null>(null);
  const memoryDisabled = !online || memory.isPending;
  const confirmDisabled = useConfirmDisabled(memoryDisabled);
  const selectedMemory =
    editor && editor !== "new"
      ? (settings.memories.find((memory) => memory.id === editor.id) ?? editor)
      : null;
  const changed = memoryText.trim() !== (selectedMemory?.text ?? "");
  const closeEditor = () => {
    setEditor(null);
  };
  const saveMemory = (onSaved: () => void) => {
    if (memoryDisabled || !memoryText.trim()) return;
    if (!changed) {
      onSaved();
      return;
    }
    memory.mutate(
      {
        action: "save-memory",
        ...(selectedMemory && {
          id: selectedMemory.id,
          version: selectedMemory.version,
        }),
        text: memoryText.trim(),
      },
      { onSuccess: onSaved },
    );
  };
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
          <SettingsRow
            label="타입"
            action={
              <div className="flex items-center gap-3" data-od-id="s-bot-type">
                <Image
                  src={character.avatar}
                  alt={`${character.label} 미리보기`}
                  width={48}
                  height={48}
                  className={cn(
                    "size-12 shrink-0 rounded-full object-contain",
                    character.avatarFramed && "bg-[var(--bot-avatar-bg)]",
                  )}
                />
                <SegmentedControl
                  label="AI 집사 타입"
                  options={botTypeOptions}
                  value={account.data?.botType ?? "butler"}
                  disabled={typeSave.isPending}
                  onValueChange={(value) => {
                    if (value !== (account.data?.botType ?? "butler"))
                      typeSave.mutate(value, { onSuccess: onSaved });
                  }}
                />
              </div>
            }
          />
          {typeSave.error && (
            <Text as="p" role="alert" className="text-error-text">
              {typeSave.error.message}
            </Text>
          )}
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
            <ListRow key={item.id} className="py-0">
              <TextButton
                className="w-full justify-start gap-3 text-left text-foreground"
                disabled={memoryDisabled}
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  memory.reset();
                  setMemoryText(item.text);
                  setEditingMemory(false);
                  setEditor(item);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{item.text}</span>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </TextButton>
            </ListRow>
          ))}
        </List>
        <TextButton
          className="justify-start justify-self-start"
          disabled={memoryDisabled}
          onClick={(event) => {
            opener.current = event.currentTarget;
            memory.reset();
            setMemoryText("");
            setEditingMemory(true);
            setEditor("new");
          }}
        >
          새 기억 추가
        </TextButton>
        {settings.memories.length > 0 && (
          <TextButton
            tone="danger"
            className="justify-start justify-self-start"
            disabled={memoryDisabled}
            onClick={() =>
              void confirm({
                disabled: confirmDisabled,
                title: "가족 기억을 모두 지울까요?",
                description:
                  "앱의 가족 기억만 지워져요. Hermes 자체 기억은 유지돼요.",
                onConfirm: () =>
                  memory.mutateAsync({ action: "reset-memories" }),
              })
            }
          >
            기억 전체 초기화
          </TextButton>
        )}
        {memory.error && !editor && (
          <Text as="p" role="alert">
            {memory.error.message}
          </Text>
        )}
      </section>
      <FormSheet
        onSaved={closeEditor}
        onCancel={
          selectedMemory
            ? () => {
                setMemoryText(selectedMemory.text);
                setEditingMemory(false);
              }
            : undefined
        }
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
        dirty={changed}
        pending={memory.isPending}
        submitDisabled={memoryDisabled || !memoryText.trim()}
        editable={editingMemory}
        leadingAction={() =>
          selectedMemory && (
            <TextButton
              tone="danger"
              aria-label="기억 삭제"
              className="justify-start justify-self-start"
              disabled={memoryDisabled}
              onClick={() =>
                void confirm({
                  disabled: confirmDisabled,
                  title: "가족 기억을 지울까요?",
                  description: "삭제한 기억은 되돌릴 수 없어요.",
                  targetName: selectedMemory.text,
                  onConfirm: async () => {
                    await memory.mutateAsync({
                      action: "delete-memory",
                      id: selectedMemory.id,
                      version: selectedMemory.version,
                    });
                    closeEditor();
                  },
                })
              }
            >
              삭제
            </TextButton>
          )
        }
        action={
          selectedMemory && (
            <TextButton
              aria-label="기억 수정"
              disabled={memoryDisabled}
              onClick={() => {
                setMemoryText(selectedMemory.text);
                setEditingMemory(true);
              }}
            >
              수정
            </TextButton>
          )
        }
        title={
          selectedMemory
            ? editingMemory
              ? "가족 기억 수정"
              : "가족 기억"
            : "새 기억 추가"
        }
        description="가족의 선호나 습관을 저장해요."
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
      >
        {(formId, onSaved) =>
          !editingMemory && selectedMemory ? (
            <Text as="p" className="whitespace-pre-wrap break-words py-4">
              {selectedMemory.text}
            </Text>
          ) : (
            <form
              id={formId}
              className="grid gap-4 py-4"
              aria-busy={memory.isPending}
              onSubmit={(event) => {
                event.preventDefault();
                saveMemory(onSaved);
              }}
            >
              <Textarea
                id="family-memory-text"
                aria-label="기억 내용"
                rows={3}
                className="resize-none overflow-y-auto bg-transparent px-0"
                value={memoryText}
                disabled={memoryDisabled}
                maxLength={2000}
                required
                placeholder="가족의 선호나 습관"
                onChange={(event) => setMemoryText(event.target.value)}
              />
              {memory.error && (
                <Text as="p" role="alert" className="text-error-text">
                  {memory.error.message}
                </Text>
              )}
            </form>
          )
        }
      </FormSheet>
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
  if (!query.data) return <AiSettingsSkeleton />;
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
