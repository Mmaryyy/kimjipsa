"use client";
import { useState } from "react";
import {
  useAiSettings,
  type AiSettings as Settings,
} from "@/entities/chat-message";
import { useAccount } from "@/features/account";
import {
  Button,
  ConfirmDialog,
  GroupLabel,
  Input,
  Text,
  TextButton,
} from "@/shared/ui";
interface Props {
  settings: Settings;
}
const AiSettingsForm = ({ settings }: Props) => {
  const { save, memory } = useAiSettings();
  const account = useAccount();
  const [name, setName] = useState(settings.name);
  const [memoryEnabled, setMemoryEnabled] = useState(settings.memoryEnabled);
  const [newMemory, setNewMemory] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reset, setReset] = useState(false);
  const admin = account.data?.membership?.role === "admin";
  return (
    <>
      <section data-od-id="set-ai" aria-label="AI 집사">
        <GroupLabel>AI 집사</GroupLabel>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ name, memoryEnabled });
          }}
        >
          <fieldset disabled={!admin || save.isPending} className="space-y-3">
            <label className="block">
              집사 이름
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={20}
              />
            </label>
            <Text as="p" variant="caption">
              맥미니에 연결된 AI를 자동으로 사용해요.
            </Text>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(event) => setMemoryEnabled(event.target.checked)}
              />
              앱의 가족 기억 사용하기
            </label>
            <Text as="p" variant="caption">
              Hermes 자체 기억은 별도로 유지되며 Hermes에서 관리할 수 있어요.
            </Text>
            <Button type="submit">
              {save.isPending ? "확인 중…" : "저장하기"}
            </Button>
          </fieldset>
          {save.error && (
            <Text as="p" role="alert" className="text-error-text">
              {save.error.message}
            </Text>
          )}
          {save.isSuccess && (
            <Text as="p" role="status">
              저장했어요.
            </Text>
          )}
        </form>
      </section>
      <section
        data-od-id="set-memory"
        aria-label="가족 기억"
        className="mt-10 space-y-3"
      >
        <GroupLabel>가족 기억</GroupLabel>
        {settings.memories.length === 0 && (
          <Text as="p" variant="caption">
            저장한 가족 기억이 없어요.
          </Text>
        )}
        {settings.memories.map((item) => (
          <div className="space-y-2" key={item.id}>
            <Input
              aria-label="기억 내용"
              value={edits[item.id] ?? item.text}
              onChange={(event) =>
                setEdits((current) => ({
                  ...current,
                  [item.id]: event.target.value,
                }))
              }
              maxLength={2000}
            />
            <TextButton
              disabled={memory.isPending}
              onClick={() =>
                memory.mutate({
                  action: "save-memory",
                  id: item.id,
                  version: item.version,
                  text: edits[item.id] ?? item.text,
                })
              }
            >
              수정하기
            </TextButton>
            <TextButton
              disabled={memory.isPending}
              tone="danger"
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
          </div>
        ))}
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            memory.mutate(
              { action: "save-memory", text: newMemory },
              { onSuccess: () => setNewMemory("") },
            );
          }}
        >
          <Input
            aria-label="새 가족 기억"
            value={newMemory}
            maxLength={2000}
            onChange={(event) => setNewMemory(event.target.value)}
            placeholder="가족의 선호나 습관"
          />
          <Button
            type="submit"
            variant="gray"
            disabled={!newMemory.trim() || memory.isPending}
          >
            기억 추가하기
          </Button>
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
    <AiSettingsForm
      key={`${query.data.version}:${query.data.memoryVersion}`}
      settings={query.data}
    />
  );
};
export default AiSettings;
