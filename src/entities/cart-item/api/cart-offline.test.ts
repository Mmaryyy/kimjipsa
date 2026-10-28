import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
const origin = "https://kimjipsa.test";
type Cached = Map<string, Response>;
type Store = Map<string, Cached>;
interface WorkerEvent {
  request?: Request | { url: string; method: string; mode: string };
  data?: { type: string };
  ports?: { postMessage: (value: unknown) => void }[];
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (promise: Promise<Response>) => void;
}
function worker(store: Store = new Map()) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const key = (request: Request | string) =>
    new URL(typeof request === "string" ? request : request.url, origin).href;
  const caches = {
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const cache = store.get(name)!;
      return {
        put: async (request: Request | string, response: Response) => {
          cache.set(key(request), response.clone());
        },
        match: async (request: Request | string) =>
          cache.get(key(request))?.clone(),
      };
    },
  };
  const fetch = vi.fn<(request: Request | string) => Promise<Response>>();
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin },
      addEventListener: (
        name: string,
        callback: (event: WorkerEvent) => void,
      ) => listeners.set(name, callback),
    },
    caches,
    fetch,
    Response,
    URL,
    Set,
  });
  async function dispatch(type: string, extra: Partial<WorkerEvent>) {
    const work: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(type)!({
      ...extra,
      waitUntil: (promise) => {
        work.push(promise);
      },
      respondWith: (promise) => {
        response = promise;
      },
    });
    const result = await response;
    await Promise.all(work);
    return result;
  }
  return {
    store,
    fetch,
    dispatch,
    get: (path: string, navigate = false) =>
      dispatch("fetch", {
        request: navigate
          ? { url: origin + path, method: "GET", mode: "navigate" }
          : new Request(origin + path),
      }),
  };
}
const account = (familyId = "family-a", userId = "actor-a") =>
  Response.json({ ok: true, data: { userId, membership: { familyId } } });
const cart = (familyId = "family-a", actorId = "actor-a") =>
  Response.json({
    ok: true,
    data: { familyId, actorId, items: [{ name: "두부" }], frequent: [] },
  });
function serve(
  harness: ReturnType<typeof worker>,
  familyId = "family-a",
  actorId = "actor-a",
) {
  harness.fetch.mockImplementation(async (request) => {
    const path = new URL(
      typeof request === "string" ? request : request.url,
      origin,
    ).pathname;
    if (path === "/api/account") return account(familyId, actorId);
    if (path === "/api/cart") return cart(familyId, actorId);
    if (path === "/api/inventory-meta")
      return Response.json({ ok: true, data: { categories: [] } });
    if (path === "/cart")
      return new Response(
        '<html><script src="/_next/static/cart.js"></script>cart shell</html>',
      );
    return new Response("cart bundle");
  });
}
describe("CART-14 ACC-17 마지막 목록과 오프라인 재시작", () => {
  it("network-first로 최신 목록을 저장하고 워커 재시작 뒤에도 읽기 전용 목록과 화면을 복구해요", async () => {
    const first = worker();
    serve(first);
    await first.get("/api/account");
    await first.get("/api/inventory-meta");
    await first.get("/api/cart");
    const restarted = worker(first.store);
    restarted.fetch.mockRejectedValue(new TypeError("network disconnected"));
    const cached = await (await restarted.get("/api/cart"))!.json();
    expect(cached.data).toMatchObject({
      items: [{ name: "두부" }],
      networkError: true,
    });
    expect(
      (await (await restarted.get("/api/account"))!.json()).data.userId,
    ).toBe("actor-a");
    expect(
      (await (await restarted.get("/api/inventory-meta"))!.json()).ok,
    ).toBe(true);
    expect(await (await restarted.get("/cart", true))!.text()).toContain(
      "cart shell",
    );
    expect(await (await restarted.get("/_next/static/cart.js"))!.text()).toBe(
      "cart bundle",
    );
    serve(restarted);
    expect(
      (await (await restarted.get("/api/cart"))!.json()).data.networkError,
    ).toBeUndefined();
  });
  it("가정이나 계정을 바꾸면 이전 캐시를 지우고 다른 가정의 응답은 저장하지 않아요", async () => {
    const harness = worker();
    serve(harness);
    await harness.get("/api/account");
    await harness.get("/api/cart");
    serve(harness, "family-b", "actor-b");
    await harness.get("/api/account");
    expect(
      [...harness.store.keys()].some((name) => name.includes("family-a")),
    ).toBe(false);
    harness.fetch.mockResolvedValueOnce(cart("family-a", "actor-a"));
    await harness.get("/api/cart");
    harness.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await harness.get("/api/cart"))?.type).toBe("error");
  });
  it("로그아웃 때 캐시를 지우고 진행 중이던 응답도 다시 저장하지 않아요", async () => {
    const harness = worker();
    serve(harness);
    await harness.get("/api/account");
    await harness.get("/api/cart");
    let complete!: (response: Response) => void;
    harness.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const inflight = harness.get("/api/cart");
    await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
    const ack = vi.fn();
    await harness.dispatch("message", {
      data: { type: "CLEAR_CART_CACHE" },
      ports: [{ postMessage: ack }],
    });
    complete(cart());
    await inflight;
    expect(ack).toHaveBeenCalledWith({ ok: true });
    expect(harness.store.size).toBe(0);
    harness.fetch.mockRejectedValue(new TypeError("offline"));
    expect((await harness.get("/api/cart"))?.type).toBe("error");
  });
  it("인증 오류가 오면 이전 목록을 대체 응답으로 쓰지 않고 지워요", async () => {
    const harness = worker();
    serve(harness);
    await harness.get("/api/account");
    await harness.get("/api/cart");
    harness.fetch.mockResolvedValueOnce(
      Response.json({ ok: false }, { status: 401 }),
    );
    expect((await harness.get("/api/cart"))?.status).toBe(401);
    expect(harness.store.size).toBe(0);
  });
});
