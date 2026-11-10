"use client";
import { CartAddButton } from "@/features/cart-add";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { markHistoryBack, cn, normalizeItemName } from "@/shared/lib";
import { inventoryRoutes, inventoryListPath } from "@/shared/config";
import {
  useInventory,
  useInventoryMeta,
  useInventoryActions,
  inventoryState,
  inventoryExpiring,
  type InventoryItem,
  type InventoryListKind,
} from "@/entities/inventory-item";
import {
  PageHeader,
  PageLayout,
  PullToAdd,
  TextButton,
  Button,
  Input,
  SegmentedControl,
  FilterTabs,
  List,
  GroupLabel,
  Skeleton,
  SkeletonSection,
  EmptyState,
  ErrorState,
  Sheet,
  Toast,
  StatusBadge,
} from "@/shared/ui";
import InventoryGroup from "./Group";
import InventoryItemEditor from "../item-editor";
const groups = [
  { value: "locations", label: "보관 장소별", odId: "by-location" },
  { value: "categories", label: "카테고리별", odId: "by-category" },
] as const;
const InventorySkeleton = ({
  groupBy,
}: {
  groupBy: "locations" | "categories";
}) => (
  <SkeletonSection label="재고를 불러오고 있어요">
    <div aria-hidden="true">
      <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        <Skeleton className="h-8 w-full" />
        <SegmentedControl
          label="묶어 보기"
          options={groups}
          value={groupBy}
          onValueChange={() => {}}
          disabled
          className="w-full min-w-0"
        />
        <div className="flex min-h-[calc(var(--ctl-h)+var(--sp-2)+var(--sp-1))] items-center gap-5 pt-2 pb-1">
          <Skeleton className="h-4 w-7" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="flex h-[calc(var(--type-caption-lh)+var(--sp-4))] items-center gap-4 pt-3 pb-1">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
      <GroupLabel className="flex h-[calc(var(--sp-5)+var(--sp-half)+var(--type-caption-lh))] items-center">
        <Skeleton className="h-3 w-16" />
      </GroupLabel>
      <List>
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            className="flex min-h-[var(--row-min)] items-center gap-2 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex h-[var(--type-body-lh)] items-center">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="hidden h-[var(--type-caption-lh)] items-center min-[381px]:flex">
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-[var(--ctl-h-xs)] w-28" />
          </li>
        ))}
      </List>
    </div>
  </SkeletonSection>
);
const InventoryPage = () => {
  const items = useInventory();
  const meta = useInventoryMeta();
  const actions = useInventoryActions();
  const router = useRouter();
  const search = useSearchParams();
  const [afterUsed, setAfterUsed] = useState<InventoryItem | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [editor, setEditor] = useState<InventoryItem | "new" | null>(null);
  const [message, setMessage] = useState("");
  const groupBy =
    search?.get("by") === "categories" ? "categories" : "locations";
  const filter = search?.get("filter") ?? "all";
  const urlQuery = search?.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [composing, setComposing] = useState(false);
  const pendingQueries = useRef(new Set<string>());
  useEffect(() => {
    if (pendingQueries.current.delete(urlQuery)) return;
    setQuery(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    if (composing || query === urlQuery) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(search?.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      pendingQueries.current.add(query);
      router.replace(`${inventoryRoutes.inventory}?${next}`, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [query, urlQuery, composing, router, search]);
  const updateSearch = (changes: Record<string, string>) => {
    const next = new URLSearchParams(search?.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${inventoryRoutes.inventory}?${next.toString()}`, {
      scroll: false,
    });
  };
  const notify = (value: string) => setMessage(value);
  const changeStatus = async (
    item: InventoryItem,
    status: InventoryItem["status"],
  ) => {
    if (item.status === status) return;
    try {
      await actions.onChange({ action: "status", id: item.id, status });
    } catch (error) {
      notify(error instanceof Error ? error.message : "변경하지 못했어요.");
    }
  };
  const adjust = async (item: InventoryItem, delta: number) => {
    try {
      await actions.onChange({ action: "adjust", id: item.id, delta });
    } catch (error) {
      notify(error instanceof Error ? error.message : "변경하지 못했어요.");
    }
  };
  let content;
  if (items.isError || meta.isError)
    content = (
      <ErrorState
        message={(items.error ?? meta.error)?.message}
        onRetry={() => {
          void items.refetch();
          void meta.refetch();
        }}
      />
    );
  else if (items.isPending || meta.isPending)
    content = <InventorySkeleton groupBy={groupBy} />;
  else {
    const entries = meta.data[groupBy].filter(
      (entry) => groupBy !== "locations" || entry.enabled,
    );
    const selectedFilter = entries.some((entry) => entry.id === filter)
      ? filter
      : "all";
    const tabItems = items.data.filter(
      (item) =>
        selectedFilter === "all" ||
        (groupBy === "locations" ? item.location_id : item.category_id) ===
          selectedFilter,
    );
    const filtered = tabItems.filter((item) =>
      normalizeItemName(item.name).includes(normalizeItemName(query)),
    );
    const hidden = meta.data.locations.filter((entry) => !entry.enabled);
    const collection = [
      ...(groupBy === "locations"
        ? hidden.map((entry) => ({
            ...entry,
            name: `${entry.name} · 숨긴 장소`,
            items: filtered.filter((item) => item.location_id === entry.id),
          }))
        : []),
      ...entries.map((entry) => ({
        ...entry,
        items: filtered.filter(
          (item) =>
            (groupBy === "locations" ? item.location_id : item.category_id) ===
            entry.id,
        ),
      })),
      {
        id: "unassigned",
        name: groupBy === "locations" ? "보관 장소 없음" : "카테고리 없음",
        enabled: true,
        sort_order: 0,
        icon_kind: null,
        icon_value: "",
        items: filtered.filter(
          (item) =>
            !meta.data[groupBy].some(
              (entry) =>
                entry.id ===
                (groupBy === "locations" ? item.location_id : item.category_id),
            ),
        ),
      },
    ];
    const summary = [
      {
        label: "없음",
        variant: "error",
        count: tabItems.filter((item) => inventoryState(item) === "none")
          .length,
      },
      {
        label: "부족",
        variant: "warning",
        count: tabItems.filter((item) => inventoryState(item) === "low").length,
      },
      {
        label: "임박",
        variant: "expiring",
        count: tabItems.filter((item) =>
          inventoryExpiring(item, meta.data.expiry_days),
        ).length,
      },
    ] as const;
    content = (
      <>
        <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <Input
            variant="glass"
            data-od-id="inv-search"
            icon={
              <Search
                aria-hidden
                className="size-4 text-[var(--icon-secondary)]"
              />
            }
            aria-label="품목 검색"
            type="search"
            placeholder="품목 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
          />
          <SegmentedControl
            odId="inv-group-by"
            label="묶어 보기"
            options={groups}
            value={groupBy}
            onValueChange={(value) =>
              updateSearch({ by: value, filter: "all" })
            }
            className="w-full min-w-0"
          />
          <div
            className="flex min-w-0 items-start gap-2"
            data-od-id="inv-filters"
          >
            <FilterTabs
              label="필터"
              options={[
                { value: "all", label: "전체", odId: "inv-filter-all" },
                ...entries.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                  odId: `inv-filter-${entry.id}`,
                })),
              ]}
              value={selectedFilter}
              onValueChange={(value) => updateSearch({ filter: value })}
              className="flex-1 overflow-x-auto pb-1"
            />
          </div>
        </div>
        <div
          data-od-id="inv-summary"
          className="flex flex-wrap gap-4 pt-3 pb-1 text-caption text-muted-foreground"
        >
          {summary.map((entry) => (
            <StatusBadge key={entry.label} variant={entry.variant}>
              {entry.label} {entry.count}
            </StatusBadge>
          ))}
        </div>
        <div data-od-id="inv-list">
          {filtered.length === 0 ? (
            <EmptyState
              message={
                query
                  ? `‘${query}’에 맞는 품목이 없어요.`
                  : selectedFilter !== "all"
                    ? "선택한 필터에 맞는 품목이 없어요."
                    : "아직 등록한 품목이 없어요."
              }
              action={
                <TextButton
                  data-od-id="inv-empty-add"
                  onClick={() => setEditor("new")}
                >
                  새 품목으로 추가
                </TextButton>
              }
            />
          ) : (
            collection
              .filter((entry) => entry.items.length > 0)
              .map((entry) => (
                <InventoryGroup
                  key={entry.id}
                  entry={entry}
                  meta={meta.data}
                  groupBy={groupBy}
                  pendingIds={actions.pendingIds}
                  expandedItemId={expandedItemId}
                  onExpandItem={setExpandedItemId}
                  onOpen={setEditor}
                  onAdjust={(item, delta) => void adjust(item, delta)}
                  onStatus={(item, status) => void changeStatus(item, status)}
                />
              ))
          )}
        </div>
        {editor && (
          <InventoryItemEditor
            item={editor === "new" ? undefined : editor}
            initialName={query}
            items={items.data}
            meta={meta.data}
            onClose={() => setEditor(null)}
            onNotify={notify}
            onUsedUp={(item) => {
              setEditor(null);
              setAfterUsed(item);
            }}
          />
        )}
      </>
    );
  }
  return (
    <PullToAdd
      action="재고 등록하기"
      onAdd={() => setEditor("new")}
      disabled={!meta.data || !items.data || !!editor || manage || !!afterUsed}
    >
      <PageLayout
        width="narrow"
        odId="inventory-main"
        className={cn([
          "flex min-h-[calc(100dvh-var(--bottom-navigation-offset)-env(safe-area-inset-bottom))] flex-col pb-4",
          "lg:min-h-[calc(100dvh-var(--sp-10))] lg:pb-0",
        ])}
        header={
          <PageHeader
            odId="inventory"
            title="재고"
            actions={
              <>
                <Button
                  variant="glass"
                  data-od-id="inv-add"
                  disabled={!meta.data || !items.data}
                  onClick={() => setEditor("new")}
                >
                  등록
                </Button>
                <Button
                  variant="glass"
                  aria-label="재고 목록 설정"
                  onClick={() => setManage(true)}
                >
                  설정
                </Button>
              </>
            }
          />
        }
      >
        {content}
        <Sheet
          open={manage}
          onOpenChange={setManage}
          title="재고 관리"
          description="가정에서 함께 쓰는 목록을 관리해요."
          odId="inv-manage-sheet"
          showCloseButton
        >
          <List>
            {(
              [
                ["categories", "카테고리", "mg-categories"],
                ["locations", "보관 장소", "mg-locations"],
                ["units", "단위", "mg-units"],
              ] satisfies [InventoryListKind, string, string][]
            ).map(([kind, label, odId]) => (
              <li key={kind}>
                <Link
                  className="flex min-h-[var(--row-min)] items-center text-primary"
                  href={inventoryListPath(kind, "inventory")}
                  onNavigate={() => {
                    markHistoryBack(inventoryRoutes.lists);
                  }}
                  data-od-id={odId}
                >
                  {label} 관리
                </Link>
              </li>
            ))}
          </List>
        </Sheet>
        <Sheet
          open={afterUsed !== null}
          onOpenChange={(open) => {
            if (!open) setAfterUsed(null);
          }}
          odId="sheet-after-used"
          title={
            afterUsed ? `${afterUsed.name} — 없음으로 바뀌었어요` : "다 썼어요"
          }
          description="장바구니에 담아 둘까요?"
        >
          <p className="py-3 text-center text-caption text-muted-foreground">
            장바구니에 담아 둘까요?
          </p>
          {afterUsed && (
            <div className="grid gap-2">
              <CartAddButton
                appearance="filled"
                odId="after-add-cart"
                onAdded={() => {
                  setAfterUsed(null);
                  notify("장바구니에 담았어요");
                }}
                item={{
                  name: afterUsed.name,
                  quantity: 1,
                  unit_id: afterUsed.unit_id,
                  category_id: afterUsed.category_id,
                  inventory_item_id: afterUsed.id,
                  memo: "",
                  link_url: "",
                }}
              />
              <Button
                variant="gray"
                data-od-id="after-skip"
                onClick={() => setAfterUsed(null)}
              >
                나중에
              </Button>
            </div>
          )}
        </Sheet>
        <Toast
          open={!!message}
          onOpenChange={(open) => {
            if (!open) setMessage("");
          }}
          message={message}
        />
      </PageLayout>
    </PullToAdd>
  );
};
export default InventoryPage;
