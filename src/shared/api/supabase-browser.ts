"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseConfig } from "@/shared/config";
export function createBrowserSupabaseClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
