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

// Higher = better. Unknown models default to 0 (then sorted by request limits + context length).
const MODEL_QUALITY: Record<string, number> = {
  // Tier 1
  "deepseek/deepseek-r1-0528:free": 100,
  "qwen/qwen3-235b-a22b:free": 97,
  "meta-llama/llama-3.3-70b-instruct:free": 95,
  "nvidia/llama-3.1-nemotron-70b-instruct:free": 93,
  "deepseek/deepseek-r1:free": 92,
  "microsoft/phi-4-reasoning-plus:free": 90,
  "nousresearch/hermes-3-llama-3.1-405b:free": 88,
  // Tier 2
  "qwen/qwen-2.5-72b-instruct:free": 85,
  "qwen/qwen3-30b-a3b:free": 83,
  "deepseek/deepseek-chat-v3-5:free": 82,
  "google/gemma-3-27b-it:free": 80,
  "microsoft/phi-4:free": 79,
  "microsoft/phi-4-reasoning:free": 78,
  "google/gemma-3-12b-it:free": 75,
  // Tier 3
  "qwen/qwen3-14b:free": 70,
  "qwen/qwen3-8b:free": 68,
  "mistralai/mistral-nemo:free": 65,
  "cohere/command-r7b-12-2024:free": 63,
  "meta-llama/llama-3.1-8b-instruct:free": 62,
  "google/gemma-2-9b-it:free": 60,
  // Tier 4
  "qwen/qwen3-4b:free": 50,
  "google/gemma-3-4b-it:free": 48,
  "mistralai/mistral-7b-instruct:free": 45,
  "qwen/qwen3-1.7b:free": 35,
  "google/gemma-3-1b-it:free": 25,
  "qwen/qwen3-0.6b:free": 15,
};

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
            quality: MODEL_QUALITY[m.id] ?? 0,
            hasRequestLimits:
              !!m.per_request_limits &&
              Object.keys(m.per_request_limits).length > 0,
          }))
          // Sort: quality score desc, then no-limit models first, then context length desc.
          .sort((a, b) => {
            const qa = MODEL_QUALITY[a.id] ?? 0;
            const qb = MODEL_QUALITY[b.id] ?? 0;
            if (qa !== qb) return qb - qa;
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
