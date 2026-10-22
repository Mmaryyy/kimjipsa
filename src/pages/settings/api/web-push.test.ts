import { afterEach, describe, expect, it, vi } from "vitest";
import { enableWebPush } from "./web-push";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("ACC-11 SCN-ACC-5 설치·권한 안내", () => {
  it("iPhone 브라우저에서는 홈 화면 추가를 안내한다", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    await expect(enableWebPush()).rejects.toThrow("홈 화면에 추가");
  });
  it("거부된 권한에서는 구독 API를 호출하지 않는다", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Desktop");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("PushManager", class {});
    const register = vi.fn();
    vi.stubGlobal("navigator", {
      userAgent: "Desktop",
      platform: "MacIntel",
      maxTouchPoints: 0,
      serviceWorker: { register },
    });
    vi.stubGlobal("Notification", { requestPermission: async () => "denied" });
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    await expect(enableWebPush()).rejects.toThrow("브라우저 설정");
    expect(register).not.toHaveBeenCalled();
  });
});
