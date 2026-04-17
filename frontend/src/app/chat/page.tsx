"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/useChatStore";
import { createChat } from "@/lib/api";

export default function ChatIndexPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { addChat } = useChatStore();
  const [creating, setCreating] = useState(false);

  async function handleNew() {
    if (creating) return;
    setCreating(true);
    try {
      const chat = await createChat("New Chat", session?.backendToken);
      addChat(chat);
      router.push(`/chat/${chat.id}`);
    } catch {
      const localId = crypto.randomUUID();
      const now = new Date().toISOString();
      addChat({ id: localId, title: "New Chat", model: "unknown", createdAt: now, updatedAt: now });
      router.push(`/chat/${localId}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold text-white">open_chat</h1>
        <p className="text-sm text-slate-500">A private AI assistant that runs anywhere.</p>
      </div>
      <button
        onClick={handleNew}
        disabled={creating}
        className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {creating ? (
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        )}
        New chat
      </button>
    </div>
  );
}
