import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "open_chat",
  description: "Local AI chat powered by Gemma",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "open_chat",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="apple-touch-icon" href="/icons/icon-192.png" />
          <meta name="mobile-web-app-capable" content="yes" />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
