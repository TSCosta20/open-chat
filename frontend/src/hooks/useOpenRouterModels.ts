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
  /** Higher = better (used for sorting in the model picker) */
  quality: number;
  /**
   * True when OpenRouter imposes per-request token limits on this free tier
   * (indicates a restricted/weekly-style quota rather than fully open access).
   */
  hasRequestLimits: boolean;
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

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API_URL}/models/openrouter/free`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((json) => {
        const free: OpenRouterFreeModel[] = (json.data as any[]).map((m) => ({
          id: m.id,
          name: cleanName(m.name),
          contextLength: m.contextLength ?? 0,
          provider: m.provider ?? parseProvider(m.id),
          quality: m.quality ?? 0,
          hasRequestLimits: !!m.hasRequestLimits,
        }));

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
