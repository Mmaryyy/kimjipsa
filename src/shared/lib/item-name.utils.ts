export function normalizeItemName(name: string) {
  return name.replace(/\s/gu, "").toLocaleLowerCase("en-US");
}
export function compareItemNames(left: string, right: string) {
  const a = normalizeItemName(left);
  const b = normalizeItemName(right);
  if (!a || !b) return "different";
  if (a === b) return "same";
  return a.includes(b) || b.includes(a) ? "similar" : "different";
}
