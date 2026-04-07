"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/useChatStore";
import { useWebLLM } from "@/hooks/useWebLLM";
import { renameChat } from "@/lib/api";
import type { Message } from "@/types";

export function useChat(chatId: string) {
  const store = useChatStore();
  const { generate } = useWebLLM();
  const { data: session } = useSession();

  const sendMessage = useCallback(
    async (content: string) => {
      const existingHistory = useChatStore.getState().messages[chatId] ?? [];
      const llmMessages = [
        ...existingHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content },
      ];

      const userMsg: Message = {
        id: crypto.randomUUID(),
        chatId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      store.appendMessage(chatId, userMsg);
      store.setIsStreaming(chatId, true);
      store.clearStreamingContent(chatId);

      try {
        let finalContent = "";
        finalContent = await generate(llmMessages, (token) => {
          store.appendStreamingContent(chatId, token);
        });

        if (finalContent) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            chatId,
            role: "assistant",
            content: finalContent,
            createdAt: new Date().toISOString(),
          };
          store.appendMessage(chatId, assistantMsg);

          const token = session?.backendToken;

          // Auto-title on first exchange
          const chat = store.chats.find((c) => c.id === chatId);
          if (chat?.title === "New Chat") {
            const newTitle = content.slice(0, 60) + (content.length > 60 ? "…" : "");
            store.renameChat(chatId, newTitle);
            renameChat(chatId, newTitle, token).catch(() => {});
          }

          // Persist to backend (best-effort)
          persistMessages(chatId, content, finalContent, token).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        store.appendMessage(chatId, {
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          content: `Sorry, ${msg}. Please try again.`,
          createdAt: new Date().toISOString(),
        });
      } finally {
        store.clearStreamingContent(chatId);
        store.setIsStreaming(chatId, false);
      }
    },
    [chatId, store, generate, session?.backendToken]
  );

  return { sendMessage };
}

async function persistMessages(
  chatId: string,
  userContent: string,
  assistantContent: string,
  token?: string,
) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  await fetch(`${API_URL}/messages/${chatId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ user: userContent, assistant: assistantContent }),
  });
}
