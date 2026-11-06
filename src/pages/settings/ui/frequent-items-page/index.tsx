"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCart, type CartInput } from "@/entities/cart-item";
import { useInventoryMeta } from "@/entities/inventory-item";
import { CartItemEditor } from "@/features/cart-item-edit";
import { cartRoutes, settingsPath } from "@/shared/config";
import { normalizeItemName, useHistoryBack } from "@/shared/lib";
import {
  PageLayout,
  PageHeader,
  List,
  ListRow,
  GroupLabel,
  TextButton,
  Text,
  ErrorState,
  EmptyState,
  ListSkeleton,
  Banner,
} from "@/shared/ui";

const FrequentItemsPage = () => {
  const cart = useCart();
  const meta = useInventoryMeta();
  const search = useSearchParams();
  const { onNavigate } = useHistoryBack(cartRoutes.frequentItems);
  const [editor, setEditor] = useState<
    (CartInput & { hidden: boolean }) | null
  >(null);
  const backHref =
    search?.get("from") === "cart" ? cartRoutes.cart : settingsPath;
  let content;
  if (cart.isError || meta.isError) {
    content = (
      <ErrorState
        message={(cart.error ?? meta.error)?.message}
        onRetry={() => {
          void cart.refetch();
          void meta.refetch();
        }}
      />
    );
  } else if (!cart.data || !meta.data) {
    content = <ListSkeleton label="자주 사는 품목을 불러오고 있어요" />;
  } else {
    const items = cart.data.frequentSettings ?? [];
    const visibleNames = new Set(
      cart.data.frequent.map((item) => normalizeItemName(item.name)),
    );
    const groups = [
      { title: "장바구니에 보이는 품목", items: cart.data.frequent },
      {
        title: "그 밖의 후보",
        items: items.filter(
          (item) => !visibleNames.has(normalizeItemName(item.name)),
        ),
      },
    ];
    content = (
      <section
        className="mt-4"
        data-od-id="frequent-items-section"
        aria-label="자주 사는 품목"
      >
        <Text as="p" variant="caption" className="mb-3 text-muted-foreground">
          구매 기록으로 고른 품목이에요. 이름은 바꿀 수 없고, 담을 때 수량은
          1이에요.
        </Text>
        {cart.offline && <Banner title="연결이 돌아온 뒤 수정할 수 있어요." />}
        {items.length === 0 && (
          <EmptyState message="아직 자주 사는 품목이 없어요." />
        )}
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <GroupLabel>{group.title}</GroupLabel>
            <List>
              {group.items.map((item) => (
                <ListRow
                  key={item.name}
                  className="py-0"
                  trailing={
                    <ChevronRight
                      aria-hidden
                      size={16}
                      className="text-[var(--icon-tertiary)]"
                    />
                  }
                >
                  <TextButton
                    className="min-h-[var(--row-min)] w-full justify-start text-left font-normal text-foreground"
                    disabled={cart.offline}
                    onClick={() =>
                      setEditor({
                        ...item,
                        hidden: "hidden" in item && item.hidden === true,
                      })
                    }
                  >
                    {item.name}{" "}
                    {"hidden" in item && item.hidden === true && (
                      <Text
                        variant="caption"
                        className="ml-2 text-muted-foreground"
                      >
                        숨김
                      </Text>
                    )}
                  </TextButton>
                </ListRow>
              ))}
            </List>
          </section>
        ))}
        {editor && (
          <CartItemEditor
            key={editor.name}
            item={editor}
            meta={meta.data}
            frequent
            disabled={cart.offline}
            onClose={() => setEditor(null)}
          />
        )}
      </section>
    );
  }
  return (
    <PageLayout
      width="narrow"
      odId="frequent-items-main"
      header={
        <PageHeader
          title="자주 사는 품목"
          odId="frequent-items"
          navigation={
            <Link
              href={backHref}
              onNavigate={onNavigate}
              aria-label="뒤로"
              data-od-id="frequent-items-back"
              className="inline-flex size-11 items-center justify-center text-primary"
            >
              <ChevronLeft aria-hidden size={20} />
            </Link>
          }
        />
      }
    >
      {content}
    </PageLayout>
  );
};
export default FrequentItemsPage;
