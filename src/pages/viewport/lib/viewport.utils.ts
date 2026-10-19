export function readViewport(
  safeAreaProbe: HTMLElement,
  headerProbe: HTMLElement,
) {
  const safeArea = getComputedStyle(safeAreaProbe);
  const visualViewport = window.visualViewport;
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  const metaContent = (name: string) =>
    document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ??
    null;
  const displayMode =
    ["fullscreen", "standalone", "browser"].find(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    ) ?? "unknown";

  return {
    measuredAt: new Date().toISOString(),
    safeAreaInsetPx: {
      top: Number.parseFloat(safeArea.paddingTop),
      right: Number.parseFloat(safeArea.paddingRight),
      bottom: Number.parseFloat(safeArea.paddingBottom),
      left: Number.parseFloat(safeArea.paddingLeft),
    },
    displayMode,
    navigatorStandalone: iosNavigator.standalone ?? null,
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    screen: { width: window.screen.width, height: window.screen.height },
    visualViewport: visualViewport
      ? {
          width: visualViewport.width,
          height: visualViewport.height,
          offsetTop: visualViewport.offsetTop,
        }
      : null,
    documentClientHeight: document.documentElement.clientHeight,
    pageHeaderPaddingTop: getComputedStyle(headerProbe).paddingTop,
    statusBarStyleMeta: metaContent("apple-mobile-web-app-status-bar-style"),
    viewportMeta: metaContent("viewport"),
    userAgent: navigator.userAgent,
  };
}

// JSON과 같은 키를 표시해 복사한 값과 화면을 쉽게 대조해요.
export function viewportEntries(
  snapshot: object,
  prefix = "",
): [string, string][] {
  return Object.entries(snapshot).flatMap(([key, value]) => {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      return viewportEntries(value, label);
    }
    return [[label, value === null ? "미지원 / 메타 없음" : String(value)]];
  });
}
