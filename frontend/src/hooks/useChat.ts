"use client";

import { useCallback } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useWebLLM } from "@/hooks/useWebLLM";
import { fetchMessages, renameChat } from "@/lib/api";
import type { Message } from "@/types";

export function useChat(chatId: string) {
  const store = useChatStore();
  const { generate } = useWebLLM();

  const sendMessage = useCallback(
    async (content: string) => {
      // 1. Build conversation history BEFORE appending the new message
      //    (store snapshot would be stale after appendMessage)
      const existingHistory = useChatStore.getState().messages[chatId] ?? [];
      const llmMessages = [
        ...existingHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content },
      ];

      // 2. Append optimistic user message
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

        // 3. Stream response from local WebLLM engine
        let finalContent = "";
        finalContent = await generate(llmMessages, (token) => {
          store.appendStreamingContent(chatId, token);
        });

        // 4. Promote streamed content to a real message
        if (finalContent) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            chatId,
            role: "assistant",
            content: finalContent,
            createdAt: new Date().toISOString(),
          };
          store.appendMessage(chatId, assistantMsg);

          // 5. Auto-title chat on first exchange (title is still "New Chat")
          const chat = store.chats.find((c) => c.id === chatId);
          if (chat?.title === "New Chat") {
            const newTitle = content.slice(0, 60) + (content.length > 60 ? "…" : "");
            store.renameChat(chatId, newTitle);
            renameChat(chatId, newTitle).catch(() => {});
          }

          // 6. Persist both messages to backend (best-effort)
          persistMessages(chatId, content, finalContent).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          content: `Sorry, ${msg}. Please try again.`,
          createdAt: new Date().toISOString(),
        };
        store.appendMessage(chatId, errorMsg);
      } finally {
        store.clearStreamingContent(chatId);
        store.setIsStreaming(chatId, false);
      }
    },
    [chatId, store, generate]
  );

  return { sendMessage };
}

async function persistMessages(chatId: string, userContent: string, assistantContent: string) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  await fetch(`${API_URL}/messages/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: userContent, assistant: assistantContent }),
  });
}
