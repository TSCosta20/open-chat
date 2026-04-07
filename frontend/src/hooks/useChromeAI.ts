"use client";

import { useCallback } from "react";

export type ChromeAIStatus = "available" | "after-download" | "unavailable";

/** Check Chrome's built-in AI availability (Gemini Nano). */
export async function checkChromeAI(): Promise<ChromeAIStatus> {
  if (typeof window === "undefined") return "unavailable";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ai = (window as any).ai;
  if (!ai?.languageModel) return "unavailable";
  try {
    const caps = await ai.languageModel.capabilities();
    if (caps.available === "readily") return "available";
    if (caps.available === "after-download") return "after-download";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export function useChromeAI() {
  const generate = useCallback(
    async (
      messages: { role: "user" | "assistant" | "system"; content: string }[],
      onToken: (token: string) => void
    ): Promise<string> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ai = (window as any).ai;
      if (!ai?.languageModel) throw new Error("Chrome AI not available in this browser");

      const systemMsg = messages.find((m) => m.role === "system");
      const chatMsgs = messages.filter((m) => m.role !== "system");

      const session = await ai.languageModel.create({
        systemPrompt: systemMsg?.content ?? "You are a helpful assistant.",
      });

      try {
        // Build a plain-text prompt from conversation history
        let prompt = "";
        for (const msg of chatMsgs.slice(0, -1)) {
          prompt += msg.role === "user"
            ? `User: ${msg.content}\n`
            : `Assistant: ${msg.content}\n`;
        }
        const last = chatMsgs[chatMsgs.length - 1];
        prompt += last?.content ?? "";

        // promptStreaming yields cumulative text — diff to get deltas
        const stream = session.promptStreaming(prompt);
        let prev = "";
        let full = "";
        for await (const text of stream) {
          const delta = text.slice(prev.length);
          prev = text;
          full = text;
          if (delta) onToken(delta);
        }
        return full;
      } finally {
        session.destroy();
      }
    },
    []
  );

  return { generate };
}
