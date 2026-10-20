"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { kstDate, type CalendarView } from "@/entities/event";

type CalendarCarouselProps = {
  date: string;
  view: CalendarView;
  onDateChange: (date: string) => void;
  renderPanel: (date: string) => ReactNode;
};

export function CalendarCarousel({
  date,
  view,
  onDateChange,
  renderPanel,
}: CalendarCarouselProps) {
  const drag = useRef<{ start: number; end: number } | null>(null);
  const [viewportRef, api] = useEmblaCarousel({
    startIndex: 1,
    watchDrag: (_api, event) => {
      const point = "touches" in event ? event.touches[0] : event;
      drag.current = { start: point.clientX, end: point.clientX };
      return true;
    },
    loop: true,
    skipSnaps: false,
    containScroll: false,
    watchSlides: false,
    watchFocus: false,
    breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
  });
  const [panel, setPanel] = useState({ date, view, index: 1 });
  const [previousLocation, setPreviousLocation] = useState({ date, view });
  const current = useRef(panel);
  const resetting = useRef(false);
  const transitioning = useRef(false);
  const currentPanel = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const move = { month: addMonths, week: addWeeks, day: addDays }[panel.view];

  if (previousLocation.date !== date || previousLocation.view !== view) {
    setPreviousLocation({ date, view });
    if (panel.date !== date || panel.view !== view) {
      setPanel({ date, view, index: 1 });
    }
  }

  useLayoutEffect(() => {
    if (
      current.current.date !== panel.date ||
      current.current.view !== panel.view
    ) {
      transitioning.current = false;
    }
    current.current = panel;
    if (!api || panel.index !== 1) return;
    resetting.current = true;
    api.scrollTo(1, true);
    resetting.current = false;
  }, [api, panel]);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      if (resetting.current) return;
      const previous = current.current;
      const index = api.selectedScrollSnap();
      const difference = index - previous.index;
      if (!difference) return;
      const displacement = drag.current
        ? drag.current.start - drag.current.end
        : 0;
      // In a three-panel loop, a long drag can select the opposite snap index.
      // Preserve the physical gesture direction instead of interpreting that index as a reversal.
      const direction =
        Math.abs(displacement) > api.rootNode().clientWidth
          ? Math.sign(displacement)
          : Math.abs(difference) === 2
            ? -Math.sign(difference)
            : difference;
      const nextDate = format(
        move(kstDate(previous.date), direction),
        "yyyy-MM-dd",
      );
      transitioning.current = true;
      current.current = { date: nextDate, view: previous.view, index };
      setPanel(current.current);
      onDateChange(nextDate);
    };
    const onSettle = () => {
      if (
        resetting.current ||
        (!transitioning.current && current.current.index === 1)
      )
        return;
      transitioning.current = false;
      // Looping keeps a following panel available during fast gestures. Recenter only at rest.
      current.current = { ...current.current, index: 1 };
      setPanel(current.current);
    };
    const onPointerUp = () => {
      drag.current = null;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        api.scrollTo(api.selectedScrollSnap(), true);
      }
    };
    const onDragMove = (event: MouseEvent | TouchEvent) => {
      if (!drag.current) return;
      const point = "touches" in event ? event.touches[0] : event;
      if (point) drag.current.end = point.clientX;
    };
    document.addEventListener("mousemove", onDragMove, true);
    document.addEventListener("touchmove", onDragMove, true);
    api.on("select", onSelect);
    api.on("settle", onSettle);
    api.on("pointerUp", onPointerUp);
    return () => {
      document.removeEventListener("mousemove", onDragMove, true);
      document.removeEventListener("touchmove", onDragMove, true);
      api.off("select", onSelect);
      api.off("settle", onSettle);
      api.off("pointerUp", onPointerUp);
    };
  }, [api, move, onDateChange]);

  useLayoutEffect(() => {
    const element = currentPanel.current;
    if (!element) return;
    const measure = () => {
      const nextHeight = element.offsetHeight;
      // Keep the outgoing panel intact until the swipe animation has settled.
      setHeight((previous) =>
        transitioning.current
          ? Math.max(previous ?? 0, nextHeight)
          : nextHeight,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [panel]);

  return (
    <div
      ref={viewportRef}
      className="overflow-hidden touch-pan-y touch-pinch-zoom"
      style={{ height }}
      data-od-id="cal-swipe"
      role="region"
      aria-roledescription="carousel"
      aria-label="달력 넘기기"
    >
      <div className="flex items-start">
        {[0, 1, 2].map((index) => {
          const distance = (index - panel.index + 3) % 3;
          const offset = distance === 2 ? -1 : distance;
          const panelDate = format(
            move(kstDate(panel.date), offset),
            "yyyy-MM-dd",
          );
          const active = index === panel.index;
          return (
            <div
              key={index}
              ref={active ? currentPanel : undefined}
              className="min-w-0 flex-[0_0_100%]"
              inert={!active}
              aria-hidden={!active}
            >
              {renderPanel(panelDate)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
