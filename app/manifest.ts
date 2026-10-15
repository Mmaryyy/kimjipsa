import type { MetadataRoute } from "next";

import { themeBackground } from "@/app/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "김집사",
    short_name: "김집사",
    description: "우리 집 일정과 살림을 함께 관리해요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: themeBackground.light,
    theme_color: themeBackground.light,
    icons: [
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/kimjipsa-app-icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
