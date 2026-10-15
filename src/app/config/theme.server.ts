import { readFileSync } from "node:fs";
import { join } from "node:path";

// 메타데이터도 앱 CSS와 같은 원본에서 읽어요. 토큰 누락은 빌드에서 실패해요.
const tokens = readFileSync(
  join(process.cwd(), "src/app/styles/tokens.css"),
  "utf8",
);
function background(selector: string): string {
  const start = tokens.indexOf(selector);
  const block = tokens.slice(start, tokens.indexOf("}", start));
  const color = block.match(/--bg:\s*([^;]+);/)?.[1]?.trim();
  if (start < 0 || !color) throw new Error(`배경 토큰 누락: ${selector}`);
  return color;
}

export const themeBackground = {
  light: background('[data-theme="light"] {'),
  dark: background('[data-theme="dark"] {'),
};
