"use client";

import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/useChatStore";
import { createChat } from "@/lib/api";
import type { Chat } from "@/types";

export function NewChatButton() {
  const router = useRouter();
  const { addChat } = useChatStore();

  async function handleNew() {
    // Create optimistically with a local ID so navigation works even if backend is slow
    const localId = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimisticChat: Chat = {
      id: localId,
      title: "New Chat",
      model: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
      createdAt: now,
      updatedAt: now,
    };
    addChat(optimisticChat);
    router.push(`/chat/${localId}`);

    // Sync to backend in background — replace local ID with real one if possible
    try {
      const real = await createChat("New Chat");
      // Update store: swap out the optimistic chat for the real one
      const store = useChatStore.getState();
      store.removeChat(localId);
      store.addChat(real);
      // If we're still on the optimistic chat page, navigate to real one
      if (window.location.pathname === `/chat/${localId}`) {
        router.replace(`/chat/${real.id}`);
      }
    } catch {
      // Keep the local chat — messages won't persist to DB but chat still works
    }
  }

  return (
    <button
      onClick={handleNew}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-surface-hover hover:text-white"
    >
      <svg
        className="h-4 w-4 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      New chat
    </button>
  );
}
