"use client";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postChat, uploadPhoto } from "@/entities/chat-message";
import { compressPhoto } from "./photo.utils";
export function useChatSend(sessionVersion: number) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [draftVersion, setDraftVersion] = useState(sessionVersion);
  if (draftVersion !== sessionVersion) {
    setDraftVersion(sessionVersion);
    setText("");
    setPhotos([]);
  }
  const requestId = useRef<string | null>(null);
  const client = useQueryClient();
  const send = useMutation({
    mutationFn: async (reply?: string) => {
      requestId.current ??= crypto.randomUUID();
      await postChat({
        sessionVersion,
        text: reply ?? text,
        attachmentIds: reply === undefined ? photos : [],
        clientRequestId: requestId.current,
      });
    },
    onError: () => {
      requestId.current = null;
      return client.invalidateQueries({ queryKey: ["chat"] });
    },
    onSuccess: async () => {
      setText("");
      setPhotos([]);
      requestId.current = null;
      await client.invalidateQueries({ queryKey: ["chat"] });
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => uploadPhoto(await compressPhoto(file)),
    onSuccess: (id) => {
      setPhotos((current) => [...current, id]);
      requestId.current = null;
    },
  });
  const onText = useCallback((value: string) => {
    setText(value);
    requestId.current = null;
  }, []);
  const onRemove = useCallback((id: string) => {
    setPhotos((current) => current.filter((photo) => photo !== id));
    requestId.current = null;
  }, []);
  return { text, photos, onText, onRemove, send, upload };
}
