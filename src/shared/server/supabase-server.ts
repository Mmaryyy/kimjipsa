import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/shared/api";
import { getSupabaseConfig } from "@/shared/config";
export async function createServerSupabaseClient<
  Role extends string = string,
  Provider extends string = string,
>() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();
  return createServerClient<Database<Role, Provider>>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // Route handlers own auth exchanges. Server Components use proxy refresh.
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Next disallows cookie writes during Server Component rendering.
        }
      },
    },
  });
}
