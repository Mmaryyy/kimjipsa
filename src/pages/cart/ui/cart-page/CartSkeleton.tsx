import { withFrequentCartDefaults } from "@/entities/cart-item";
import {
  Button,
  GroupLabel,
  Input,
  List,
  Skeleton,
  SkeletonSection,
} from "@/shared/ui";
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
      <GroupLabel>
        <span className="flex h-[var(--type-caption-lh)] items-center">
          <Skeleton className="h-3 w-16" />
        </span>
      </GroupLabel>
      <List>
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="flex min-h-11 items-start gap-3 py-2">
            <Skeleton className="mt-1 size-5 flex-none rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex min-h-7 items-center gap-x-2">
                <div className="flex min-w-0 flex-1 items-center">
                  <Skeleton className="h-4 w-32 max-w-full" />
                </div>
                <div className="-my-2 inline-flex h-11 shrink-0 items-center">
                  <Skeleton className="h-4 w-11 rounded-full" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </List>
    </div>
  </SkeletonSection>
);

export default CartSkeleton;
