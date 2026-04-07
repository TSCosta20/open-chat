"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
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
  const { getToken } = useAuth();

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Load chat list on mount — pass auth token
  useEffect(() => {
    getToken().then((token) => {
      fetchChats(token ?? undefined)
        .then(setChats)
        .catch(() => {});
    });
  }, [setChats, getToken]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      <OfflineBanner />
    </div>
  );
}
