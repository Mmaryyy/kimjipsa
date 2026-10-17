import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { mockDataSchemas, type MockData } from "./mock-data.schema";
import {
  isMockDataEnabled,
  mockEnabledCookie,
  mockSessionCookie,
  mockPerspectiveCookie,
  mockStageCookie,
} from "@/shared/config";

type Session = { touched: number; values: Map<string, unknown> };
const globalStore = globalThis as typeof globalThis & {
  mockSessions?: Map<string, Session>;
};
const sessions = (globalStore.mockSessions ??= new Map<string, Session>());
export async function isServerMockDataEnabled() {
  if (process.env.NODE_ENV !== "development") return false;
  const jar = await cookies();
  return isMockDataEnabled(jar.get(mockEnabledCookie)?.value ?? "");
}
export async function mockContext() {
  if (!(await isServerMockDataEnabled())) return null;
  const jar = await cookies();
  const sessionId = jar.get(mockSessionCookie)?.value;
  if (!sessionId)
    throw new Error(
      "테스트 데이터 세션을 시작하려면 화면을 새로고침해 주세요.",
    );
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.touched > 3600000) sessions.delete(key);
  }
  let session = sessions.get(sessionId);
  if (!session) {
    session = { touched: now, values: new Map() };
    sessions.set(sessionId, session);
  }
  session.touched = now;
  return {
    values: session.values,
    perspective: jar.get(mockPerspectiveCookie)?.value === "spouse" ? 1 : 0,
    stage: jar.get(mockStageCookie)?.value ?? "ready",
  };
}
// Raw fixture data never leaves entity server functions.
export async function mockJson<Name extends keyof MockData>(
  name: Name,
): Promise<MockData[Name]> {
  const context = await mockContext();
  if (!context) throw new Error("개발용 테스트 데이터가 꺼져 있어요.");
  if (!context.values.has(name)) {
    // Share the in-flight read so concurrent requests use one mutable fixture.
    const pending = readFile(
      path.join(process.cwd(), "mocks", `${name}.json`),
      "utf8",
    )
      .then((text) => {
        const value = mockDataSchemas[name].parse(JSON.parse(text));
        context.values.set(name, value);
        return value;
      })
      .catch((error: unknown) => {
        context.values.delete(name);
        throw error;
      });
    context.values.set(name, pending);
  }
  return context.values.get(name) as MockData[Name];
}
