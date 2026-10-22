"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { viewportPath } from "@/shared/config";
import { Button, List, ListRow, Text } from "@/shared/ui";
import {
  defaultSpacing,
  spacingSchedule,
  spacingStorageKey,
  spacingValues,
} from "../config/spacing.constants";
import { readViewport } from "../lib/viewport.utils";
import { spacingButtonStyles } from "./viewport-spacing.variants";

export function ViewportSpacingPage() {
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const safeAreaProbe = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLElement>(null);
  const [spacing, setSpacing] = useState<number>(defaultSpacing);
  const [storageMessage, setStorageMessage] = useState("");
  const [measurement, setMeasurement] = useState<{
    displayMode: string;
    safeAreaTop: number;
    paddingTop: string;
    scrollY: number;
  } | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = sessionStorage.getItem(spacingStorageKey);
        const value = spacingValues.find((value) => String(value) === saved);
        if (value !== undefined) setSpacing(value);
      } catch {
        setStorageMessage("이 브라우저에서는 선택한 값을 저장할 수 없어요.");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const bar = controls.current;
    if (!bar) return;
    const updateHeight = () => {
      root.current?.style.setProperty(
        "--spacing-controls-height",
        `${bar.getBoundingClientRect().height}px`,
      );
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);
    updateHeight();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      if (!safeAreaProbe.current || !header.current) return;
      const viewport = readViewport(safeAreaProbe.current, header.current);
      setMeasurement({
        displayMode: viewport.displayMode,
        safeAreaTop: viewport.safeAreaInsetPx.top,
        paddingTop: viewport.pageHeaderPaddingTop,
        scrollY: window.scrollY,
      });
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const modes = ["browser", "standalone", "fullscreen"].map((mode) =>
      window.matchMedia(`(display-mode: ${mode})`),
    );
    scheduleMeasure();
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("pageshow", scheduleMeasure);
    modes.forEach((mode) => mode.addEventListener("change", scheduleMeasure));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("pageshow", scheduleMeasure);
      modes.forEach((mode) =>
        mode.removeEventListener("change", scheduleMeasure),
      );
    };
  }, [spacing]);

  const onSpacingChange = (value: number) => {
    setSpacing(value);
    try {
      sessionStorage.setItem(spacingStorageKey, String(value));
      setStorageMessage("");
    } catch {
      setStorageMessage("이 브라우저에서는 선택한 값을 저장할 수 없어요.");
    }
  };

  return (
    <div
      ref={root}
      className="pb-[var(--spacing-controls-height,50vh)]"
      data-od-id="viewport-spacing-main"
    >
      {/* 공용 헤더와 같은 구조로 두고, 실험값만 상단 패딩에 적용해요. */}
      <header
        ref={header}
        className="kj-page-header"
        style={{ paddingTop: spacing }}
        data-od-id="viewport-spacing-header"
      >
        <Text
          as="p"
          variant="body-sm"
          className="text-muted-foreground"
          data-od-id="viewport-spacing-date"
        >
          10월 19일 월요일 · 도토리네
        </Text>
        <div className="flex items-center gap-2 [&_h1]:min-w-0 [&_h1]:flex-1">
          <Text as="h1" variant="title-lg" data-od-id="viewport-spacing-title">
            오늘
          </Text>
        </div>
      </header>
      <div
        ref={safeAreaProbe}
        aria-hidden="true"
        className="pointer-events-none invisible fixed top-0 left-0"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      />
      <Text
        as="p"
        variant="caption"
        className="text-muted-foreground tabular-nums"
        data-od-id="viewport-spacing-measurements"
      >
        display-mode: {measurement?.displayMode ?? "측정 중"} ·
        env(safe-area-inset-top):{" "}
        {measurement ? `${measurement.safeAreaTop}px` : "측정 중"} · 헤더
        padding-top: {measurement?.paddingTop ?? "측정 중"} · window.scrollY:{" "}
        {measurement?.scrollY ?? "측정 중"}
      </Text>
      <Text as="p" variant="body-sm" className="mt-3 text-muted-foreground">
        값을 바꾼 뒤 맨 위와 스크롤 중을 비교해 주세요. 날짜와 제목이 흐려지지
        않는 가장 작은 값을 알려 주세요.
      </Text>
      <section className="mt-6" aria-labelledby="spacing-schedule-title">
        <Text as="h2" variant="title" id="spacing-schedule-title">
          실험용 일정
        </Text>
        <List data-od-id="viewport-spacing-list">
          {spacingSchedule.map((event) => (
            <ListRow
              key={event.id}
              description="도토리네 · 공유"
              leading={
                <Text
                  variant="caption"
                  className="w-[60px] shrink-0 text-muted-foreground tabular-nums"
                >
                  {event.time}
                </Text>
              }
            >
              {event.id}. {event.title}
            </ListRow>
          ))}
        </List>
      </section>
      <aside
        ref={controls}
        aria-label="여백 실험"
        className="fixed inset-x-0 bottom-0 z-50 bg-background px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+var(--sp-4))]"
        data-od-id="viewport-spacing-controls"
      >
        <div className="mx-auto max-w-[var(--content-max)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Text
              variant="title-lg"
              aria-live="polite"
              className="tabular-nums"
            >
              상단 여백 {spacing}px
            </Text>
            <Link
              href={viewportPath}
              className="kj-hit text-primary text-label"
            >
              화면 정보
            </Link>
          </div>
          <div className="grid grid-cols-5 gap-3 sm:grid-cols-9">
            {spacingValues.map((value) => (
              <Button
                key={value}
                variant="gray"
                aria-pressed={value === spacing}
                className={spacingButtonStyles({ selected: value === spacing })}
                onClick={() => onSpacingChange(value)}
              >
                {value}px
              </Button>
            ))}
          </div>
          {storageMessage && (
            <Text as="p" variant="caption" role="status" className="mt-2">
              {storageMessage}
            </Text>
          )}
        </div>
      </aside>
    </div>
  );
}
