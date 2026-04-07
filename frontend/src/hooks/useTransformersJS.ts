"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";
import type { ModelId } from "@/types";

// Singleton worker — survives re-renders
let _worker: Worker | null = null;
let _loadedModelId: ModelId | null = null;
let _loadPromise: Promise<void> | null = null;
let _nextId = 0;

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL("../workers/transformers-worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return _worker;
}

export function useTransformersJS() {
  const store = useChatStore();
  const abortedRef = useRef(false);

  const loadModel = useCallback(
    async (modelId: ModelId) => {
      if (_loadedModelId === modelId) {
        store.setModelReady(true);
        return;
      }
      if (_loadPromise) {
        await _loadPromise;
        return;
      }

      store.setModelReady(false);
      store.setModelLoadProgress(0, "Initialising…");

      _loadPromise = new Promise<void>((resolve, reject) => {
        const worker = getWorker();

        const handler = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.type === "progress") {
            const pct = Math.round((msg.progress ?? 0) * 100);
            store.setModelLoadProgress(pct, msg.status ?? "Loading…");
          }
          if (msg.type === "ready") {
            _loadedModelId = modelId;
            store.setModelLoadProgress(100, "Model ready");
            store.setModelReady(true);
            worker.removeEventListener("message", handler);
            resolve();
          }
          if (msg.type === "error") {
            store.setModelLoadProgress(0, msg.message);
            store.setModelReady(false);
            _loadedModelId = null;
            worker.removeEventListener("message", handler);
            reject(new Error(msg.message));
          }
        };

        worker.addEventListener("message", handler);
        worker.postMessage({ type: "load", modelId });
      }).finally(() => {
        _loadPromise = null;
      });

      await _loadPromise;
    },
    [store]
  );

  const generate = useCallback(
    async (
      messages: { role: "user" | "assistant" | "system"; content: string }[],
      onToken: (token: string) => void
    ): Promise<string> => {
      if (!_worker || !_loadedModelId) throw new Error("Transformers model not loaded");

      abortedRef.current = false;
      const id = _nextId++;

      return new Promise<string>((resolve, reject) => {
        const worker = _worker!;
        let full = "";

        const handler = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.id !== id) return;

          if (msg.type === "token") {
            if (!abortedRef.current) {
              full += msg.text;
              onToken(msg.text);
            }
          }
          if (msg.type === "done") {
            worker.removeEventListener("message", handler);
            resolve(full);
          }
          if (msg.type === "error") {
            worker.removeEventListener("message", handler);
            reject(new Error(msg.message));
          }
        };

        worker.addEventListener("message", handler);
        worker.postMessage({ type: "generate", id, messages });
      });
    },
    []
  );

  const abort = useCallback(() => {
    abortedRef.current = true;
  }, []);

  return { loadModel, generate, abort };
}
