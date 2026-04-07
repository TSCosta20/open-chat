"use client";

import { useCallback, useEffect, useRef } from "react";
import * as webllm from "@mlc-ai/web-llm";
import { useChatStore } from "@/store/useChatStore";
import type { ModelId } from "@/types";

// Singleton worker + engine — persists across renders
let _engine: webllm.WebWorkerMLCEngine | null = null;
let _loadedModelId: ModelId | null = null;
let _initPromise: Promise<void> | null = null;

function createWorker(): Worker {
  return new Worker(new URL("../workers/mlc-worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useWebLLM() {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);

  const loadModel = useCallback(
    async (modelId: ModelId) => {
      // Already loaded — nothing to do
      if (_engine && _loadedModelId === modelId) {
        store.setModelReady(true);
        return;
      }

      // Prevent double-init
      if (_initPromise) {
        await _initPromise;
        return;
      }

      store.setModelReady(false);
      store.setModelLoadProgress(0, "Initialising…");

      _initPromise = (async () => {
        try {
          // Terminate old worker if switching models
          if (_engine) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (_engine as any).terminate?.();
            _engine = null;
          }

          _engine = await webllm.CreateWebWorkerMLCEngine(
            createWorker(),
            modelId,
            {
              initProgressCallback: (report) => {
                const pct = Math.round(report.progress * 100);
                store.setModelLoadProgress(pct, report.text);
              },
            }
          );

          _loadedModelId = modelId as ModelId;
          store.setModelLoadProgress(100, "Model ready");
          store.setModelReady(true);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to load model";
          store.setModelLoadProgress(0, msg);
          store.setModelReady(false);
          _engine = null;
          _loadedModelId = null;
        } finally {
          _initPromise = null;
        }
      })();

      await _initPromise;
    },
    [store]
  );

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
        max_tokens: 512,
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

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { loadModel, generate, abort };
}
