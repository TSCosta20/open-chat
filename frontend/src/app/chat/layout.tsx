"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // Load chat list once we have a session token
  useEffect(() => {
    if (!session?.backendToken) return;
    fetchChats(session.backendToken).then(setChats).catch(() => {});
  }, [session?.backendToken, setChats]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      <OfflineBanner />
    </div>
  );
}
