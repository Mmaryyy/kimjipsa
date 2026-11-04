"use client";

import { ArrowUp, Paperclip, PlusIcon, X } from "lucide-react";
import {
  Button,
  Loader,
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  Text,
} from "@/shared/ui";
import { useChatSend } from "../../model/use-chat-send";
import { useRef } from "react";

interface Props {
  sessionVersion: number;
  disabled?: boolean;
}
const ChatComposer = ({ disabled = false, sessionVersion }: Props) => {
  const { text, photos, onText, onRemove, send, upload } =
    useChatSend(sessionVersion);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = send.isPending || upload.isPending;
  const canSend = !disabled && !pending && (!!text.trim() || photos.length > 0);
  const error = send.error ?? upload.error;
  return (
    <PromptInput
      data-od-id="chat-input"
      aria-label="집사에게 메시지 보내기"
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) send.mutate();
      }}
    >
      {photos.length > 0 && (
        <ul aria-label="전송할 사진" className="flex flex-wrap gap-2">
          {photos.map((id, index) => (
            <li key={id} className="flex items-center gap-1 text-caption">
              <Paperclip
                className="size-3 text-[var(--icon-secondary)]"
                aria-hidden="true"
              />
              사진 {index + 1}
              <Button
                variant="gray"
                size="icon-sm"
                aria-label={`사진 ${index + 1} 빼기`}
                disabled={pending}
                onClick={() => onRemove(id)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="chat-message" className="sr-only">
        집사에게 보낼 메시지
      </label>
      <PromptInputTextarea
        id="chat-message"
        rows={2}
        value={text}
        maxLength={10000}
        disabled={disabled || pending}
        className="max-h-40 resize-none text-body-sm leading-[1.55] placeholder:text-body-sm [field-sizing:content]"
        placeholder="나만 보는 집사에게 요청하세요"
        enterKeyHint="send"
        onChange={(event) => onText(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            if (canSend) event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <PromptInputFooter>
        <input
          ref={fileInput}
          className="sr-only"
          tabIndex={-1}
          aria-label="영수증 사진 선택"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled || pending || photos.length >= 4}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
        <Button
          variant="gray"
          size="icon-sm"
          disabled={disabled || pending || photos.length >= 4}
          aria-label="사진 첨부"
          onClick={() => fileInput.current?.click()}
        >
          {upload.isPending ? (
            <Loader />
          ) : (
            <PlusIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
        <PromptInputSubmit
          data-od-id="chat-send"
          aria-label={send.isPending ? "보내는 중" : "보내기"}
          disabled={!canSend}
          size="icon-sm"
        >
          {pending ? (
            <Loader />
          ) : (
            <ArrowUp className="size-4" aria-hidden="true" />
          )}
        </PromptInputSubmit>
      </PromptInputFooter>
      {error && (
        <Text as="p" role="alert" className="text-error-text">
          {error.message}
        </Text>
      )}
    </PromptInput>
  );
};
export default ChatComposer;
