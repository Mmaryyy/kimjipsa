"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  useInventoryMeta,
  useInventoryActions,
  InventoryCategoryIcon,
  type InventoryMetaEntry,
} from "@/entities/inventory-item";
import { useCart, useCartActions } from "@/entities/cart-item";
import { settingsPath, inventoryRoutes, cartRoutes } from "@/shared/config";
import {
  PageHeader,
  List,
  ListRow,
  TextButton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Text,
  ConfirmDialog,
  Toast,
} from "@/shared/ui";
import InventoryListEditor from "../list-editor";
const listLabels = {
  categories: "재고 카테고리",
  locations: "보관 장소",
  units: "단위",
} as const;
const InventoryListsPage = () => {
  const search = useSearchParams();
  const origin = search?.get("from");
  const back =
    origin === "cart"
      ? { href: cartRoutes.cart, label: "장바구니" }
      : origin === "inventory"
        ? { href: inventoryRoutes.inventory, label: "재고" }
        : { href: settingsPath, label: "설정" };
  const query = search?.get("kind");
  const kind =
    query === "locations" || query === "units" ? query : "categories";
  const meta = useInventoryMeta();
  const actions = useInventoryActions();
  const cart = useCart();
  const orderAction = useCartActions();
  const categories = [...(meta.data?.categories ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const moveCategory = async (index: number, direction: number) => {
    if (cart.offline || orderAction.isPending) return;
    const ids = categories.map((entry) => entry.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await orderAction.mutateAsync({ action: "order", ids });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "순서를 바꾸지 못했어요.",
      );
    }
  };
  const [editor, setEditor] = useState<InventoryMetaEntry | "new" | null>(null);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const reset = async () => {
    try {
      await actions.meta.mutateAsync({ action: "reset", kind });
      setResetting(false);
      setMessage("기본 목록으로 되돌렸어요.");
    } catch (error) {
      setResetting(false);
      setMessage(error instanceof Error ? error.message : "되돌리지 못했어요.");
    }
  };
  let content;
  if (meta.isError)
    content = (
      <ErrorState
        message={meta.error.message}
        onRetry={() => void meta.refetch()}
      />
    );
  else if (meta.isPending)
    content = <ListSkeleton label="목록을 불러오고 있어요" />;
  else
    content = (
      <section
        data-od-id="lists-section"
        aria-label={listLabels[kind]}
        className="mt-4"
      >
        {meta.data[kind].length === 0 && (
          <EmptyState message="아직 등록한 목록이 없어요." />
        )}
        <List data-od-id="lists-items">
          {(kind === "categories" ? categories : meta.data[kind]).map(
            (entry, index) => (
              <ListRow
                key={entry.id}
                className="py-0"
                leading={
                  kind === "categories" ? (
                    <InventoryCategoryIcon category={entry} />
                  ) : undefined
                }
                trailing={
                  kind === "categories" ? (
                    <div className="flex shrink-0">
                      <TextButton
                        className="size-11"
                        aria-label={`${entry.name} 위로 이동`}
                        disabled={
                          cart.offline ||
                          !cart.data ||
                          orderAction.isPending ||
                          index === 0
                        }
                        onClick={() => void moveCategory(index, -1)}
                      >
                        <ArrowUp size={16} aria-hidden />
                      </TextButton>
                      <TextButton
                        className="size-11"
                        aria-label={`${entry.name} 아래로 이동`}
                        disabled={
                          cart.offline ||
                          !cart.data ||
                          orderAction.isPending ||
                          index === categories.length - 1
                        }
                        onClick={() => void moveCategory(index, 1)}
                      >
                        <ArrowDown size={16} aria-hidden />
                      </TextButton>
                    </div>
                  ) : (
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-[var(--icon-tertiary)]"
                    />
                  )
                }
              >
                <TextButton
                  className="min-h-[var(--row-min)] w-full justify-start text-left font-normal text-foreground"
                  onClick={() => setEditor(entry)}
                >
                  {entry.name}
                  {kind === "locations" && !entry.enabled && (
                    <Text
                      variant="caption"
                      className="ml-2 text-muted-foreground"
                    >
                      사용 안 함
                    </Text>
                  )}
                </TextButton>
              </ListRow>
            ),
          )}
        </List>
        <div className="mt-3 grid justify-items-start gap-1">
          <TextButton data-od-id="lists-add" onClick={() => setEditor("new")}>
            <Plus aria-hidden size={16} /> {listLabels[kind]} 추가
          </TextButton>
          <TextButton
            size="sm"
            className="text-muted-foreground"
            data-od-id="lists-reset"
            onClick={() => setResetting(true)}
          >
            기본 목록으로 되돌리기
          </TextButton>
        </div>
        {editor && (
          <InventoryListEditor
            key={editor === "new" ? "new" : editor.id}
            kind={kind}
            nextSortOrder={
              Math.max(
                -1,
                ...meta.data[kind].map((entry) => entry.sort_order),
              ) + 1
            }
            entry={editor === "new" ? undefined : editor}
            onClose={() => setEditor(null)}
            onNotify={setMessage}
          />
        )}
      </section>
    );
  return (
    <div data-od-id="lists-main" className="mx-auto lg:max-w-130">
      <PageHeader
        title={listLabels[kind]}
        odId="lists"
        navigation={
          <Link
            href={back.href}
            data-od-id="lists-back"
            className="flex w-fit items-center gap-1 text-primary"
          >
            <ChevronLeft aria-hidden size={16} />
            {back.label}
          </Link>
        }
      />
      {content}
      <ConfirmDialog
        open={resetting}
        onOpenChange={setResetting}
        targetName={listLabels[kind]}
        title="기본 목록으로 되돌릴까요?"
        description={
          kind === "units"
            ? "직접 추가하거나 바꾼 단위는 사라져요. 품목에 쓰인 단위는 그대로 남아요."
            : kind === "categories"
              ? "직접 추가한 카테고리의 품목만 기타로 옮겨요. " +
                "기본 카테고리 연결은 유지돼요."
              : "숨긴 장소도 다시 보여요. 품목의 보관 장소는 그대로 유지돼요."
        }
        confirmLabel="되돌리기"
        pending={actions.meta.isPending}
        onConfirm={() => void reset()}
      />
      <Toast
        open={!!message}
        onOpenChange={(open) => {
          if (!open) setMessage("");
        }}
        message={message}
      />
    </div>
  );
};
export default InventoryListsPage;
