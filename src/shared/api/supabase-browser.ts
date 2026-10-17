"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseConfig, isMockDataEnabled } from "@/shared/config";
export function createBrowserSupabaseClient() {
  if (isMockDataEnabled())
    throw new Error("테스트 데이터 모드에서는 Supabase에 접근할 수 없어요.");
  const { url, key } = getSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
