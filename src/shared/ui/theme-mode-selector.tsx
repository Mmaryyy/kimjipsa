"use client";

import { themeModes } from "@/shared/config";
import { useThemeMode } from "@/shared/lib";
import { SegmentedControl } from "./segmented-control";

export function ThemeModeSelector() {
  const { mode, setMode } = useThemeMode();
  return (
    <SegmentedControl
      odId="s-theme"
      label="화면 모드"
      options={themeModes}
      value={mode}
      onValueChange={setMode}
    />
  );
}
