import { timingSafeEqual } from "node:crypto";
export function validCronSecret(
  received: string | null,
  expected: string | undefined,
) {
  if (!received || !expected) return false;
  const actualBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}
