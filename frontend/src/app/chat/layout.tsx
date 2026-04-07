"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useChatStore } from "@/store/useChatStore";
import { fetchChats } from "@/lib/api";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const setChats = useChatStore((s) => s.setChats);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failure is non-fatal
      });
    }
  }, []);

  // Load chat list on mount
  useEffect(() => {
    fetchChats()
      .then(setChats)
      .catch(() => {
        // Backend unreachable — UI still loads
      });
  }, [setChats]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      <OfflineBanner />
    </div>
  );
}
