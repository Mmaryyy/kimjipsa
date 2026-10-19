import "@/app/styles/globals.css";

import type { Metadata, Viewport } from "next";
import {
  QueryProvider,
  ServiceWorkerRegistration,
  ThemeColorSync,
} from "@/app/providers";

import { AppLayout } from "@/app/ui";
import type { ReactNode } from "react";
import { ToastProvider } from "@/shared/ui";
import { themeModeStorageKey } from "@/shared/config";
import { themeBackground } from "@/app/config/theme.server";

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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeBackground.light },
    { media: "(prefers-color-scheme: dark)", color: themeBackground.dark },
  ],
};

const themeModeInitScript = `
  try {
    const mode = localStorage.getItem(${JSON.stringify(themeModeStorageKey)});
    if (mode === "light" || mode === "dark") {
      document.documentElement.dataset.theme = mode;
      document.documentElement.dataset.themeMode = mode;
    }
  } catch {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeModeInitScript,
          }}
        />
      </head>
      {/* 브라우저 확장이 하이드레이션 전에 body에 속성을 주입하므로 이 요소의 속성 차이만 경고를 억제하며, 자식 트리 불일치는 계속 경고한다. */}
      <body suppressHydrationWarning>
        <ToastProvider>
          <QueryProvider>
            <AppLayout>{children}</AppLayout>
          </QueryProvider>
        </ToastProvider>
        <ServiceWorkerRegistration />
        <ThemeColorSync />
      </body>
    </html>
  );
}
