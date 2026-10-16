import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

import noColorLiterals from "./scripts/eslint/no-color-literals.mjs";

const layers = ["pages", "widgets", "features", "entities", "shared"];
const element = (type, extra = {}) => ({ element: { type, ...extra } });

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".yarn/**",
    ".corepack-bin/**",
    "out/**",
    "next-env.d.ts",
    "docs/design/prototype/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
  ]),
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    plugins: {
      boundaries,
      tokens: { rules: { "no-color-literals": noColorLiterals } },
    },
    settings: {
      "boundaries/root-path": fileURLToPath(new URL(".", import.meta.url)),
      "boundaries/elements": [
        { type: "routes", pattern: "app", partialMatch: false },
        { type: "app", pattern: "src/app", partialMatch: false },
        // 여러 라우트가 있는 도메인에서는
        // 각 라우트를 독립 슬라이스로 봐요.
        {
          type: "pages",
          pattern: "src/pages/*/!(ui|model|lib|api|config|@x)",
          partialMatch: false,
          capture: ["domain", "slice"],
        },
        ...layers.map((type) => ({
          type,
          pattern: `src/${type}/*`,
          partialMatch: false,
          capture: ["slice"],
        })),
      ],
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
    },
    rules: {
      "tokens/no-color-literals": "error",
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown-dependencies": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: element(["routes", "app"]),
              allow: { to: element(["app", ...layers]) },
            },
            ...layers.map((layer, index) => ({
              from: element(layer),
              allow: { to: element(layers.slice(index + 1)) },
            })),
            { from: element("shared"), allow: { to: element("shared") } },
            // 레이어 방향을 통과해도
            // 다른 슬라이스 내부 파일에는 접근할 수 없어요.
            {
              from: element("*"),
              disallow: {
                to: element(layers, { fileInternalPath: "!index.{ts,tsx}" }),
              },
            },
            // 서버 API는 클라이언트 배럴과 분리한 공개 진입점만 써요.
            {
              from: element("app"),
              allow: {
                to: element("entities", {
                  fileInternalPath: "index.server.ts",
                }),
              },
            },
            // entities/<제공자>/@x/<소비자>.ts에
            // 노출한 타입만 예외예요.
            {
              from: element("entities"),
              allow: {
                to: element("entities", {
                  fileInternalPath: "@x/{{ from.element.captured.slice }}.ts",
                }),
                dependency: { kind: "type" },
              },
            },
          ],
        },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
]);
