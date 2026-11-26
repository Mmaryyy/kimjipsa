export const amountFormats = ["won", "number", "korean", "symbol"] as const;
export type AmountFormat = (typeof amountFormats)[number];

const tenThousand = BigInt(10_000);
const hundredMillion = BigInt(100_000_000);

export function formatAmount(
  value: number | bigint,
  format: AmountFormat = "won",
): string {
  const negative = value < 0;
  const sign = negative ? "-" : "";
  const magnitude = negative ? -value : value;
  const digits = magnitude.toLocaleString("ko-KR");

  if (format === "number") return sign + digits;
  if (format === "symbol") return `${sign}₩${digits}`;
  if (format !== "korean") return `${sign}${digits}원`;

  const [integer, fraction] = digits.replaceAll(",", "").split(".");
  const whole = BigInt(integer);
  if (whole < tenThousand) return `${sign}${digits}원`;
  const eok = whole / hundredMillion;
  const man = (whole % hundredMillion) / tenThousand;
  const remainder = whole % tenThousand;
  const parts = [
    eok && `${eok.toLocaleString("ko-KR")}억`,
    man && `${man.toLocaleString("ko-KR")}만`,
  ].filter(Boolean);
  if (remainder || fraction) {
    const decimal = fraction ? `.${fraction}` : "";
    return `${sign}${parts.join(" ")} ${remainder.toLocaleString("ko-KR")}${decimal}원`;
  }
  return `${sign}${parts.join(" ")} 원`;
}
