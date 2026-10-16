import type { NextRequest } from "next/server";
import { updateSession } from "@/shared/server/index.proxy";
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|icons/|images/|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
