import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseConfig,
  isMockDataEnabled,
  mockEnabledCookie,
  mockSessionCookie,
} from "@/shared/config";
import type { Database } from "@/shared/api";
export async function updateSession(request: NextRequest) {
  if (
    process.env.NODE_ENV === "development" &&
    isMockDataEnabled(request.cookies.get(mockEnabledCookie)?.value ?? "")
  ) {
    const fresh = !request.cookies.get(mockSessionCookie)?.value;
    const sessionId = fresh
      ? crypto.randomUUID()
      : request.cookies.get(mockSessionCookie)!.value;
    request.cookies.set(mockSessionCookie, sessionId);
    const response = NextResponse.next({ request });
    if (fresh)
      response.cookies.set(mockSessionCookie, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  // With no local DB configured, still serve the UI so the dev switch is reachable.
  if (
    process.env.NODE_ENV === "development" &&
    (!process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
