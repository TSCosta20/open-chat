"use client";

import { useState, useEffect } from "react";

export interface OpenRouterFreeModel {
  id: string;
  /** Display name from OpenRouter */
  name: string;
  /** Short description */
  description?: string;
  /** Context window size in tokens */
  contextLength: number;
  /** Provider slug, e.g. "meta-llama", "google", "deepseek" */
  provider: string;
  /**
   * True when OpenRouter imposes per-request token limits on this free tier
   * (indicates a restricted/weekly-style quota rather than fully open access).
   */
  hasRequestLimits: boolean;
}

interface RawModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  per_request_limits?: Record<string, string> | null;
}

const CACHE_KEY = "or_free_models_v2";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function parseProvider(id: string): string {
  return id.split("/")[0] ?? id;
}

export function useOpenRouterModels(): {
  models: OpenRouterFreeModel[];
  loading: boolean;
  error: boolean;
} {
  const [models, setModels] = useState<OpenRouterFreeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL_MS) {
          setModels(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore stale/corrupt cache
    }

    fetch("https://openrouter.ai/api/v1/models")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((json) => {
        const free: OpenRouterFreeModel[] = (json.data as RawModel[])
          .filter(
            (m) =>
              m.id.endsWith(":free") &&
              m.pricing?.prompt === "0" &&
              m.pricing?.completion === "0",
          )
          .map((m) => ({
            id: m.id,
            name: cleanName(m.name),
            description: m.description?.slice(0, 120),
            contextLength: m.context_length ?? 0,
            provider: parseProvider(m.id),
            hasRequestLimits:
              !!m.per_request_limits &&
              Object.keys(m.per_request_limits).length > 0,
          }))
          // Sort: no-limit models first, then by context length (bigger = better)
          .sort((a, b) => {
            if (a.hasRequestLimits !== b.hasRequestLimits)
              return a.hasRequestLimits ? 1 : -1;
            return b.contextLength - a.contextLength;
          });

        setModels(free);
        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), data: free }),
          );
        } catch {
          // storage quota exceeded — ignore
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return { models, loading, error };
}

/** Strip "(free)" suffixes and provider prefixes that OpenRouter adds */
function cleanName(raw: string): string {
  return raw
    .replace(/\s*\(free\)\s*/gi, "")
    .replace(/\s*\[free\]\s*/gi, "")
    .trim();
}
