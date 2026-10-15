import { createServer } from "node:net";
import { defineConfig, devices } from "@playwright/test";

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  if (!address || typeof address === "string") {
    throw new Error("E2E 서버 포트를 찾지 못했어요.");
  }
  return address.port;
}

const port = process.env.E2E_PORT
  ? Number(process.env.E2E_PORT)
  : await availablePort();
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("E2E_PORT는 1~65535 사이 정수여야 해요.");
}
// 테스트 worker가 설정을 다시 읽어도 같은 서버를 사용해요.
process.env.E2E_PORT = String(port);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `yarn build && yarn start --hostname 127.0.0.1 --port ${port}`,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
