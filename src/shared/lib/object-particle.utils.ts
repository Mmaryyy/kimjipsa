export function objectParticle(name: string): "을" | "를" {
  const last = name.charCodeAt(name.length - 1);
  return last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? "을" : "를";
}
