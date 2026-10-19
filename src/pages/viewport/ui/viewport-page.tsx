"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { settingsPath, viewportSpacingPath } from "@/shared/config";
import { Button, Text } from "@/shared/ui";
import { readViewport, viewportEntries } from "../lib/viewport.utils";

export function ViewportPage() {
  const safeAreaProbe = useRef<HTMLDivElement>(null);
  const headerProbe = useRef<HTMLDivElement>(null);
  const jsonOutput = useRef<HTMLPreElement>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<
    typeof readViewport
  > | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  const onMeasure = useCallback(() => {
    if (!safeAreaProbe.current || !headerProbe.current) return;
    setSnapshot(readViewport(safeAreaProbe.current, headerProbe.current));
    setCopyMessage("");
  }, []);

  useEffect(() => {
    let frame = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(onMeasure);
    };
    const displayModes = ["browser", "standalone", "fullscreen"].map((mode) =>
      window.matchMedia(`(display-mode: ${mode})`),
    );
    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    window.addEventListener("pageshow", scheduleMeasure);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", scheduleMeasure);
    visualViewport?.addEventListener("scroll", scheduleMeasure);
    displayModes.forEach((mode) =>
      mode.addEventListener("change", scheduleMeasure),
    );
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      window.removeEventListener("pageshow", scheduleMeasure);
      visualViewport?.removeEventListener("resize", scheduleMeasure);
      visualViewport?.removeEventListener("scroll", scheduleMeasure);
      displayModes.forEach((mode) =>
        mode.removeEventListener("change", scheduleMeasure),
      );
    };
  }, [onMeasure]);

  const json = snapshot ? JSON.stringify(snapshot, null, 2) : "";
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyMessage("복사했어요.");
    } catch {
      const output = jsonOutput.current;
      const selection = window.getSelection();
      if (output && selection) {
        output.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(output);
        selection.removeAllRanges();
        selection.addRange(range);
        setCopyMessage(
          "자동 복사가 안 돼요. 선택된 JSON을 길게 눌러 복사해 주세요.",
        );
      } else {
        setCopyMessage(
          "자동 복사가 안 돼요. 아래 JSON을 직접 선택해 복사해 주세요.",
        );
      }
    }
  }, [json]);

  const entries = snapshot ? viewportEntries(snapshot) : [];

  return (
    <div
      className="pt-[calc(env(safe-area-inset-top)+var(--sp-5))] pb-[calc(env(safe-area-inset-bottom)+var(--sp-5))]"
      data-od-id="viewport-main"
    >
      <div
        ref={safeAreaProbe}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 invisible"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
        }}
      />
      {/* 기존 헤더 규칙을 측정하되 진단 화면 배치에는 영향을 주지 않아요. */}
      <div
        ref={headerProbe}
        aria-hidden="true"
        className="kj-page-header pointer-events-none fixed top-0 left-0 invisible"
      />
      <header className="mb-6" data-od-id="viewport-header">
        <Link
          href={settingsPath}
          className="kj-hit text-caption text-muted-foreground"
        >
          설정으로 돌아가기
        </Link>
        <Text as="h1" variant="display" className="mt-4">
          화면 정보
        </Text>
        <Text as="p" variant="body-sm" className="mt-2 text-muted-foreground">
          개발용 진단 화면이에요. 길이 단위는 px이며, null은 미지원 또는 메타
          없음이에요.
        </Text>
        <Link
          href={viewportSpacingPath}
          className="kj-hit mt-4 inline-flex min-h-[var(--hit)] items-center text-primary text-label"
          data-od-id="viewport-spacing-link"
        >
          여백 실험 열기
        </Link>
        <div
          className="mt-4 flex flex-wrap gap-3"
          data-od-id="viewport-actions"
        >
          <Button onClick={onMeasure} variant="gray">
            다시 재기
          </Button>
          <Button onClick={onCopy} disabled={!snapshot}>
            복사
          </Button>
        </div>
        <Text as="p" variant="caption" role="status" className="mt-3">
          {copyMessage}
        </Text>
      </header>
      {!snapshot && (
        <Text as="p" role="status">
          화면 정보를 재고 있어요.
        </Text>
      )}
      <dl
        className="grid min-w-0 gap-6 md:grid-cols-2"
        data-od-id="viewport-values"
      >
        {entries.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-caption text-muted-foreground [overflow-wrap:anywhere]">
              {label}
            </dt>
            <dd className="mt-1 text-title-lg tabular-nums [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <section
        className="mt-10"
        aria-labelledby="viewport-json-title"
        data-od-id="viewport-json"
      >
        <Text as="h2" variant="title" id="viewport-json-title">
          전체 JSON
        </Text>
        <pre
          ref={jsonOutput}
          tabIndex={0}
          aria-label="전체 화면 정보 JSON"
          className="mt-3 select-text whitespace-pre-wrap font-code text-caption [overflow-wrap:anywhere]"
        >
          {json}
        </pre>
      </section>
    </div>
  );
}
