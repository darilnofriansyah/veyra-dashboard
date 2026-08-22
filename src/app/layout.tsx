import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { TelegramMiniApp } from "@/components/telegram-mini-app";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Veyra",
    template: "%s · Veyra"
  },
  description: "Veyra financial overview",
  icons: { icon: "/assets/veyra-mark.png" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f8fb"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js?63" strategy="beforeInteractive" />
        {children}
        <TelegramMiniApp />
      </body>
    </html>
  );
}
