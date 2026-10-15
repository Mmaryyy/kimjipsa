import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ESLint } from "eslint";

const prefix = `boundary-canary-${randomUUID()}`;
const first = `${prefix}-a`;
const second = `${prefix}-b`;
const roots = [
  `src/shared/${first}`,
  `src/entities/${first}`,
  `src/entities/${second}`,
  `src/features/${first}`,
  `src/features/${second}`,
  `src/pages/${first}`,
  `src/pages/${second}`,
  `src/widgets/${first}`,
  `src/widgets/${second}`,
  `src/app/${prefix}`,
  `app/${prefix}`,
];
const fixtures = {
  [`src/shared/${first}/index.ts`]: "export type Example = string;",
  [`src/entities/${first}/index.ts`]: "export type Example = string;",
  [`src/entities/${second}/index.ts`]: "export type Example = string;",
  [`src/entities/${second}/lib/internal.ts`]: "export type Example = string;",
  [`src/entities/${second}/@x/${first}.ts`]: "export type Example = string;",
  [`src/features/${first}/index.ts`]: "export type Example = string;",
  [`src/features/${second}/index.ts`]: "export type Example = string;",
  [`src/pages/${first}/one/index.ts`]: "export type Example = string;",
  [`src/pages/${first}/two/index.ts`]: "export type Example = string;",
};
fixtures[`src/pages/${second}/index.ts`] = "export type Example = string;";
fixtures[`src/widgets/${first}/index.ts`] = "export type Example = string;";
fixtures[`src/widgets/${second}/index.ts`] = "export type Example = string;";
fixtures[`src/app/${prefix}/index.ts`] = "export type Example = string;";
fixtures[`src/entities/${second}/@x/${first}.ts`] =
  "export type Example = string; export const example = 1;";

const cases = [
  [
    "widget 하위 레이어",
    `src/widgets/${first}/canary.ts`,
    `@/features/${first}`,
    true,
  ],
  [
    "widget 역방향",
    `src/features/${first}/canary.ts`,
    `@/widgets/${first}`,
    false,
  ],
  [
    "widget 형제",
    `src/widgets/${first}/canary.ts`,
    `@/widgets/${second}`,
    false,
  ],
  [
    "page 다른 슬라이스",
    `src/pages/${first}/canary.ts`,
    `@/pages/${second}`,
    false,
  ],
  ["routes에서 app", `app/${prefix}/canary.ts`, `@/app/${prefix}`, true],
  ...["shared", "entities", "features", "widgets", "pages"].map((layer) => [
    `${layer}에서 app 역방향`,
    `src/${layer}/${first}/canary.ts`,
    `@/app/${prefix}`,
    false,
  ]),
  [
    "entity @x 값",
    `src/entities/${first}/canary.ts`,
    `@/entities/${second}/@x/${first}`,
    false,
    true,
  ],
  [
    "역방향 alias",
    `src/shared/${first}/canary.ts`,
    `@/features/${first}`,
    false,
  ],
  [
    "역방향 상대경로",
    `src/shared/${first}/canary.ts`,
    `../../features/${first}`,
    false,
  ],
  [
    "entity 형제",
    `src/entities/${first}/canary.ts`,
    `@/entities/${second}`,
    false,
  ],
  [
    "feature 형제",
    `src/features/${first}/canary.ts`,
    `@/features/${second}`,
    false,
  ],
  [
    "깊은 import",
    `src/features/${first}/canary.ts`,
    `@/entities/${second}/lib/internal`,
    false,
  ],
  [
    "하위 레이어 public API",
    `src/features/${first}/canary.ts`,
    `@/entities/${second}`,
    true,
  ],
  [
    "같은 슬라이스 상대경로",
    `src/entities/${second}/canary.ts`,
    "./lib/internal",
    true,
  ],
  // prettier-ignore
  [
    "shared 세그먼트",
    `src/shared/${first}/canary.ts`,
    "@/shared/lib",
    true,
  ],
  [
    "entity @x 타입",
    `src/entities/${first}/canary.ts`,
    `@/entities/${second}/@x/${first}`,
    true,
  ],
  [
    "잘못된 @x 소비자",
    `src/features/${first}/canary.ts`,
    `@/entities/${second}/@x/${first}`,
    false,
  ],
  [
    "도메인 내 다른 라우트",
    `src/pages/${first}/one/canary.ts`,
    `@/pages/${first}/two`,
    false,
  ],
];

const cleanup = () =>
  Promise.all(roots.map((path) => rm(path, { recursive: true, force: true })));
const signalHandlers = new Map();
for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  const handler = () => {
    // 시그널 처리 중 fixture 생성이 계속되지 않도록 동기 정리해요.
    for (const path of roots) rmSync(path, { recursive: true, force: true });
    process.exit(code);
  };
  signalHandlers.set(signal, handler);
  process.once(signal, handler);
}

try {
  for (const [path, contents] of Object.entries(fixtures)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }

  const eslint = new ESLint();
  for (const [label, filePath, source, allowed, valueImport] of cases) {
    const results = await eslint.lintText(
      valueImport
        ? `import { example } from "${source}";\nexport const result = example;\n`
        : `import type { Example } from "${source}";\nexport type Result = Example;\n`,
      { filePath },
    );
    const messages = results.flatMap((result) => result.messages);
    assert.equal(
      messages.some((message) => message.fatal),
      false,
      `${label}: 파싱 실패`,
    );
    const violations = messages.filter((message) =>
      message.ruleId?.startsWith("boundaries/"),
    );
    assert.equal(
      violations.length === 0,
      allowed,
      `${label}: ${JSON.stringify(messages)}`,
    );
    console.info(`${allowed ? "허용" : "차단"} 확인: ${label}`);
  }
} finally {
  await cleanup();
  for (const [signal, handler] of signalHandlers) {
    process.removeListener(signal, handler);
  }
}
