import { cn } from "@/shared/lib";
import { List, ListRow } from "./list";
export function ListSkeleton({
  rows = 3,
  label = "목록을 불러오고 있어요",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      <List aria-hidden="true">
        {Array.from({ length: Math.max(0, rows) }, (_, index) => (
          <ListRow
            key={index}
            leading={
              <span
                className={cn([
                  "rounded-[var(--sp-half)] bg-[var(--fill-quaternary)] animate-skeleton-pulse",
                  "motion-reduce:animate-none size-[var(--ctl-h-sm)] flex-none",
                ])}
              />
            }
          >
            <div
              className={cn([
                "h-3.5 rounded-[var(--sp-half)] bg-[var(--fill-quaternary)] animate-skeleton-pulse",
                "motion-reduce:animate-none w-13/20",
              ])}
            />
            <div
              className={cn([
                "h-3.5 rounded-[var(--sp-half)] bg-[var(--fill-quaternary)] animate-skeleton-pulse",
                "motion-reduce:animate-none mt-2 w-2/5",
              ])}
            />
          </ListRow>
        ))}
      </List>
    </div>
  );
}
