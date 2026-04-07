"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-red-900/90 px-4 py-2 text-center text-sm text-red-100 backdrop-blur-sm">
      <span className="mr-2">⚡</span>
      You&apos;re offline — chat is unavailable until reconnected
    </div>
  );
}
