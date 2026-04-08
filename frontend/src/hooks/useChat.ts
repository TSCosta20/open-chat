"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/useChatStore";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useTransformersJS } from "@/hooks/useTransformersJS";
import { useChromeAI } from "@/hooks/useChromeAI";
import { renameChat } from "@/lib/api";
import { speak } from "@/hooks/useVoiceInput";
import { ALL_MODELS } from "@/types";
import type { Message } from "@/types";
import { getStoredApiKeys } from "@/hooks/useApiKeys";

// If no token arrives within this time, the device can't handle the model
const FIRST_TOKEN_TIMEOUT_MS = 30_000;
// If token rate drops below this after 10 tokens, device is struggling
const MIN_TOKEN_RATE = 0.4; // tokens/sec
const RATE_CHECK_AFTER = 10; // tokens

export function useChat(chatId: string) {
  const store = useChatStore();
  const { generate: generateWebLLM, abort: abortWebLLM } = useWebLLM();
  const { generate: generateTransformers, abort: abortTransformers } = useTransformersJS();
  const { generate: generateChromeAI } = useChromeAI();
  const { data: session } = useSession();

  const sendMessage = useCallback(
    async (content: string, speakResponse = false) => {
      const selectedModel = useChatStore.getState().getModelForChat(chatId);
      const modelDef = ALL_MODELS.find((m) => m.id === selectedModel);

      const existingHistory = (useChatStore.getState().messages[chatId] ?? [])
        .filter((m) => m.content !== "__SUGGEST_LOCAL__" && m.content !== "__TOO_HEAVY__");
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

      const onToken = (token: string) => store.appendStreamingContent(chatId, token);
      const token = session?.backendToken;
      let finalContent = "";
      let cloudHandledPersist = false;

      try {
        if (modelDef?.backend === "chrome-ai") {
          finalContent = await generateChromeAI(llmMessages, onToken);
        } else if (modelDef?.backend === "cloud") {
          const { openRouterKey, geminiKey } = getStoredApiKeys();
          finalContent = await streamCloud(
            chatId,
            content,
            modelDef.cloudModelId!,
            token,
            onToken,
            (s) => store.setCloudStatus(chatId, s),
            openRouterKey,
            geminiKey,
          );
          cloudHandledPersist = true;
        } else {
          // Local inference (WebLLM or Transformers.js) — watchdog for overloaded device
          const abort = modelDef?.backend === "transformers" ? abortTransformers : abortWebLLM;
          const generate = modelDef?.backend === "transformers" ? generateTransformers : generateWebLLM;

          let tokenCount = 0;
          let firstTokenAt: number | null = null;
          let tooHeavy = false;

          // Watchdog: kill if no first token within 30s
          const watchdog = setTimeout(() => {
            tooHeavy = true;
            abort();
          }, FIRST_TOKEN_TIMEOUT_MS);

          finalContent = await generate(llmMessages, (tok) => {
            const now = Date.now();
            if (firstTokenAt === null) {
              firstTokenAt = now;
              clearTimeout(watchdog); // first token arrived in time
            }
            tokenCount++;
            // After N tokens, check if rate is too slow
            if (tokenCount === RATE_CHECK_AFTER && firstTokenAt !== null) {
              const elapsed = (now - firstTokenAt) / 1000;
              const rate = tokenCount / elapsed;
              if (rate < MIN_TOKEN_RATE) {
                tooHeavy = true;
                abort();
                return;
              }
            }
            if (!tooHeavy) onToken(tok);
          });

          clearTimeout(watchdog);

          if (tooHeavy) {
            throw new Error("__TOO_HEAVY__");
          }
        }

        if (finalContent) {
          const assistantMsg: Message = {
            id: crypto.randomUUID(),
            chatId,
            role: "assistant",
            content: finalContent,
            createdAt: new Date().toISOString(),
          };
          store.appendMessage(chatId, assistantMsg);

          // Auto-title on first exchange
          const chat = store.chats.find((c) => c.id === chatId);
          if (chat?.title === "New Chat") {
            const newTitle = content.slice(0, 60) + (content.length > 60 ? "…" : "");
            store.renameChat(chatId, newTitle);
            renameChat(chatId, newTitle, token).catch(() => {});
          }

          if (speakResponse) speak(finalContent);

          // Cloud backend already persisted both messages; skip for local
          if (!cloudHandledPersist) {
            persistMessages(chatId, content, finalContent, token).catch(() => {});
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        const isSuggestLocal = msg.includes("suggest_local");
        const isTooHeavy = msg === "__TOO_HEAVY__";
        store.appendMessage(chatId, {
          id: crypto.randomUUID(),
          chatId,
          role: "assistant",
          content: isTooHeavy
            ? "__TOO_HEAVY__"
            : isSuggestLocal
            ? "__SUGGEST_LOCAL__"
            : `Sorry, ${msg}. Please try again.`,
          createdAt: new Date().toISOString(),
        });
      } finally {
        store.clearStreamingContent(chatId);
        store.setIsStreaming(chatId, false);
        store.setCloudStatus(chatId, "");
      }
    },
    [chatId, store, generateWebLLM, generateTransformers, generateChromeAI, session?.backendToken]
  );

  return { sendMessage };
}

// ── Cloud inference via backend SSE ──────────────────────────────────────────

async function streamCloud(
  chatId: string,
  content: string,
  cloudModelId: string,
  authToken: string | undefined,
  onToken: (t: string) => void,
  onStatus: (s: string) => void,
  openRouterKey = "",
  geminiKey = "",
): Promise<string> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${API_URL}/chat/cloud`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      chat_id: chatId,
      content,
      model: cloudModelId,
      openrouter_key: openRouterKey,
      gemini_key: geminiKey,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Cloud inference failed" }));
    throw new Error(err.detail ?? "Cloud inference failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from cloud endpoint");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return full;
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          if (parsed.suggest_local) throw new Error("suggest_local");
          throw new Error(parsed.error);
        }
        if (parsed.type === "status") {
          onStatus(parsed.text ?? "");
        } else if (parsed.type === "token" || parsed.token) {
          const tok = parsed.text ?? parsed.token;
          full += tok;
          onToken(tok);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue; // incomplete chunk
        throw e;
      }
    }
  }

  return full;
}

// ── Local persistence ─────────────────────────────────────────────────────────

async function persistMessages(
  chatId: string,
  userContent: string,
  assistantContent: string,
  token?: string
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
