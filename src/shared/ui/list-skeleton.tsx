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
            leading={<span className="kj-list-skeleton kj-list-skeleton-dot" />}
          >
            <div className="kj-list-skeleton kj-list-skeleton-title" />
            <div className="kj-list-skeleton kj-list-skeleton-detail" />
          </ListRow>
        ))}
      </List>
    </div>
  );
}
