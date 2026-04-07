"use client";

import { useEffect, useState } from "react";
import { AVAILABLE_MODELS } from "@/types";

/**
 * Returns a Set of model IDs that are already fully cached in the browser.
 * WebLLM stores model weights in the Cache API under cache names that contain
 * the model ID in the request URLs.
 */
export function useCachedModels(): Set<string> {
  const [cached, setCached] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;

    async function detect() {
      const found = new Set<string>();
      try {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          // WebLLM uses cache names like "webllm/model", "webllm/config", etc.
          if (!cacheName.startsWith("webllm")) continue;
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          for (const req of keys) {
            for (const model of AVAILABLE_MODELS) {
              if (req.url.includes(model.id)) {
                found.add(model.id);
              }
            }
          }
        }
      } catch {
        // Cache API may not be available in some contexts
      }
      setCached(found);
    }

    detect();
  }, []);

  return cached;
}
