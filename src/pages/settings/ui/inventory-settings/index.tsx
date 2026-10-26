"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  useInventoryMeta,
  useInventoryActions,
} from "@/entities/inventory-item";
import { inventoryListPath } from "@/shared/config";
import {
  ErrorState,
  ListSkeleton,
  FormFieldRow,
  Input,
  TextButton,
  Text,
  Toast,
} from "@/shared/ui";
const InventorySettings = () => {
  const meta = useInventoryMeta();
  const actions = useInventoryActions();
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  if (meta.isError)
    return (
      <ErrorState
        message={meta.error.message}
        onRetry={() => void meta.refetch()}
      />
    );
  if (meta.isPending)
    return <ListSkeleton label="재고 설정을 불러오고 있어요" />;
  const saveExpiry = async () => {
    const days = Number(draft);
    if (draft === null || days === meta.data.expiry_days) return;
    if (
      draft.trim() === "" ||
      !Number.isSafeInteger(days) ||
      days < 0 ||
      days > 30
    ) {
      setMessage("임박 기준은 0~30 사이의 정수로 입력해 주세요.");
      return;
    }
    try {
      await actions.meta.mutateAsync({ action: "expiry", days });
      setDraft(null);
      setMessage("임박 기준을 저장했어요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했어요.");
    }
  };
  const rows = [
    { kind: "categories", label: "재고 카테고리", odId: "s-inv-categories" },
    { kind: "locations", label: "보관 장소", odId: "s-locations" },
    { kind: "units", label: "단위", odId: "s-units" },
  ] as const;
  return (
    <>
      {rows.map(({ kind, label, odId }) => (
        <Link
          key={kind}
          href={inventoryListPath(kind)}
          data-od-id={odId}
          className="flex min-h-[var(--row-min)] items-center justify-between gap-3 py-2"
        >
          <Text>{label}</Text>
          <span className="flex items-center gap-2 text-muted-foreground">
            <Text variant="body-sm">{meta.data[kind].length}개</Text>
            <ChevronRight
              aria-hidden
              size={16}
              className="text-[var(--icon-tertiary)]"
            />
          </span>
        </Link>
      ))}
      <div data-od-id="s-expiry-days">
        <FormFieldRow label="유통기한 임박 기준" htmlFor="expiry-days">
          {(props) => (
            <div className="flex items-center gap-2">
              <Input
                {...props}
                aria-label="유통기한 임박 기준 일수"
                type="number"
                min="0"
                max="30"
                step="1"
                value={draft ?? String(meta.data.expiry_days)}
                onChange={(event) => setDraft(event.target.value)}
                className="max-w-16"
              />
              일 전
              {draft !== null && Number(draft) !== meta.data.expiry_days && (
                <TextButton
                  disabled={actions.meta.isPending}
                  onClick={() => void saveExpiry()}
                >
                  저장
                </TextButton>
              )}
            </div>
          )}
        </FormFieldRow>
      </div>
      <Toast
        open={!!message}
        onOpenChange={(open) => {
          if (!open) setMessage("");
        }}
        message={message}
      />
    </>
  );
};
export default InventorySettings;
