import { withFrequentCartDefaults } from "@/entities/cart-item";
import { Button, Input, Skeleton, SkeletonSection } from "@/shared/ui";
import CartFrequentItems from "./FrequentItems";

const CartSkeleton = () => (
  <SkeletonSection label="장바구니를 불러오고 있어요">
    <div aria-hidden="true" inert>
      {/* shortcut: QuickAddForm 입력 행과 스타일을 함께 바꾼다. 입력 모양이 확장되면 공용화한다. */}
      <div className="mt-2 flex gap-2">
        <Input
          variant="glass"
          className="min-h-[var(--ctl-h)] flex-1"
          placeholder="항목 추가 (예: 두부 2모)"
          disabled
        />
        <Button
          variant="glass"
          size="sm"
          className="text-primary disabled:opacity-40"
          disabled
        >
          추가
        </Button>
      </div>
      <CartFrequentItems
        frequent={withFrequentCartDefaults([])}
        disabled
        onAdd={async () => false}
      />
      <Skeleton className="mt-5" />
    </div>
  </SkeletonSection>
);

export default CartSkeleton;
