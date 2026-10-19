import type { EventCategory } from "@/entities/event";

// Pointer and keyboard drops share the same position-to-order conversion.
export function moveCategory(
  categories: EventCategory[],
  activeId: string,
  overId: string,
) {
  const from = categories.findIndex((category) => category.id === activeId);
  const to = categories.findIndex((category) => category.id === overId);
  if (from < 0 || to < 0 || from === to) return null;
  const ordered = [...categories];
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved!);
  return {
    category: categories[from]!,
    sortOrder: to,
    categories: ordered.map((category, sortOrder) => ({
      ...category,
      sortOrder,
    })),
  };
}
