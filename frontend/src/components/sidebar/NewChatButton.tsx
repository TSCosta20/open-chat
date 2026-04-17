"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/useChatStore";
import { createChat } from "@/lib/api";

export function NewChatButton() {
  const router = useRouter();
  const { addChat } = useChatStore();
  const { data: session } = useSession();
  const [creating, setCreating] = useState(false);

  async function handleNew() {
    if (creating) return;
    setCreating(true);
    try {
      // Always get the real ID from the backend before navigating.
      // This avoids the optimistic-UUID race where messages get persisted
      // under a local ID that is later replaced, breaking cross-device sync.
      const chat = await createChat("New Chat", session?.backendToken);
      addChat(chat);
      router.push(`/chat/${chat.id}`);
    } catch {
      // Fallback to optimistic if backend is unreachable
      const localId = crypto.randomUUID();
      const now = new Date().toISOString();
      addChat({ id: localId, title: "New Chat", model: "unknown", createdAt: now, updatedAt: now });
      router.push(`/chat/${localId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <button
      onClick={handleNew}
      disabled={creating}
      className="flex w-full items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-surface-hover hover:text-white disabled:opacity-50"
    >
      {creating ? (
        <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      )}
      New chat
    </button>
  );
}
