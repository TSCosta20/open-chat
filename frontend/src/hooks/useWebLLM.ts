"use client";

import { useCallback, useEffect, useRef } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { useChatStore } from "@/store/useChatStore";
import type { ModelId } from "@/types";

// Singleton engine — persists across renders, survives hot reload in dev
let _engine: webllm.MLCEngine | null = null;
let _loadedModelId: ModelId | null = null;

export function useWebLLM() {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  // Load (or reuse) a model. Shows progress via store.
  const loadModel = useCallback(
    async (modelId: ModelId) => {
      // Already loaded — nothing to do
      if (_engine && _loadedModelId === modelId) {
        store.setModelReady(true);
        return;
      }

      store.setModelReady(false);
      store.setModelLoadProgress(0, "Initialising…");

      try {
        _engine = await webllm.CreateMLCEngine(modelId, {
          initProgressCallback: (report) => {
            const pct = Math.round(report.progress * 100);
            store.setModelLoadProgress(pct, report.text);
          },
        });

        _loadedModelId = modelId as ModelId;
        store.setModelLoadProgress(100, "Model ready");
        store.setModelReady(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load model";
        store.setModelLoadProgress(0, msg);
        store.setModelReady(false);
        _engine = null;
        _loadedModelId = null;
      }
    },
    [store]
  );

  // Generate a streaming response. Calls onToken for each chunk, returns full text.
  const generate = useCallback(
    async (
      messages: { role: "user" | "assistant" | "system"; content: string }[],
      onToken: (token: string) => void
    ): Promise<string> => {
      if (!_engine) throw new Error("Model not loaded");

      abortRef.current = new AbortController();

      let full = "";
      const stream = await _engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
      });

      for await (const chunk of stream) {
        if (abortRef.current?.signal.aborted) break;
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onToken(delta);
        }
      }

      return full;
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // On unmount, do NOT destroy the engine — keep it alive for next render
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { loadModel, generate, abort };
}
