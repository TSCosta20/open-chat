"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/useChatStore";
import { createChat } from "@/lib/api";
import type { Chat } from "@/types";

export function NewChatButton() {
  const router = useRouter();
  const { addChat } = useChatStore();
  const { data: session } = useSession();

  async function handleNew() {
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

    try {
      const real = await createChat("New Chat", session?.backendToken);
      const store = useChatStore.getState();
      store.removeChat(localId);
      store.addChat(real);
      if (window.location.pathname === `/chat/${localId}`) {
        router.replace(`/chat/${real.id}`);
      }
    } catch {
      // Keep local chat
    }
  }

  return (
    <button
      onClick={handleNew}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-surface-hover hover:text-white"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      New chat
    </button>
  );
}
