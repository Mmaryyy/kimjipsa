import {
  Button,
  GroupLabel,
  List,
  Skeleton,
  SkeletonSection,
} from "@/shared/ui";
const CartSkeleton = () => (
  <SkeletonSection label="장바구니를 불러오고 있어요">
    <div aria-hidden="true">
      <div className="mt-2 flex gap-2">
        <Skeleton className="h-[var(--ctl-h)] min-w-0 flex-1" />
        <Button size="sm" disabled>
          추가
        </Button>
      </div>
      <section className="mt-4">
        <GroupLabel className="pt-0">자주 사는 품목</GroupLabel>
        <div className="flex gap-4 pt-1 pb-2.5">
          <Skeleton className="h-[var(--ctl-h-sm)] w-20" />
          <Skeleton className="h-[var(--ctl-h-sm)] w-20" />
        </div>
      </section>
      <GroupLabel className="flex h-[calc(var(--sp-5)+var(--sp-half)+var(--type-caption-lh))] items-center">
        <Skeleton className="h-3 w-16" />
      </GroupLabel>
      <List>
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="flex min-h-11 items-start gap-3 py-2">
            <Skeleton className="mt-1 size-5 flex-none rounded-full" />
            <div className="flex h-[var(--type-label-lh)] items-center">
              <Skeleton className="h-4 w-32" />
            </div>
          </li>
        ))}
      </List>
    </div>
  </SkeletonSection>
);

export default CartSkeleton;
