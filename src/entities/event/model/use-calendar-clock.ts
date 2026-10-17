"use client";
import { useEffect, useState } from "react";
export function useCalendarClock() {
  const [instant, setInstant] = useState(() => new Date());
  useEffect(() => {
    const update = () => setInstant(new Date());
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return instant;
}
