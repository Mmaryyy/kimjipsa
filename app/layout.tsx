import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { themeBackground } from "@/app/config";
import { ServiceWorkerRegistration, ThemeColorSync } from "@/app/providers";
import "@/app/styles/globals.css";

export const metadata: Metadata = {
  title: "김집사",
  description: "우리 집 일정과 살림을 함께 관리해요.",
  appleWebApp: { capable: true, title: "김집사" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeBackground.light },
    { media: "(prefers-color-scheme: dark)", color: themeBackground.dark },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <ServiceWorkerRegistration />
        <ThemeColorSync />
      </body>
    </html>
  );
}
