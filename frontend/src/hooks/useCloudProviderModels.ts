"use client";

import { useEffect, useState } from "react";

export interface CloudProviderModel {
  id: string;
  name: string;
  provider: string;
  quality: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

function cacheKey(provider: string, baseUrl?: string) {
  return `oc_cloud_models_${provider}_${baseUrl ?? ""}`;
}

export function useCloudProviderModels(opts: {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
}): { models: CloudProviderModel[]; loading: boolean; error: boolean } {
  const provider = (opts.provider ?? "").toLowerCase();
  const apiKey = opts.apiKey?.trim() ?? "";
  const baseUrl = opts.baseUrl?.trim() ?? "";

  const [models, setModels] = useState<CloudProviderModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!provider) return;
    if (provider === "openrouter") return;
    if (provider === "router" && (!apiKey || !baseUrl)) {
      setModels([]);
      setLoading(false);
      setError(false);
      return;
    }
    if (provider !== "gemini" && !apiKey) {
      setModels([]);
      setLoading(false);
      setError(false);
      return;
    }

    const key = cacheKey(provider, baseUrl);
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL_MS) {
          setModels(cached.data ?? []);
          setLoading(false);
          setError(false);
          return;
        }
      }
    } catch {
      // ignore corrupt cache
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    setLoading(true);
    setError(false);

    fetch(`${API_URL}/models/cloud/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        api_key: apiKey,
        base_url: baseUrl || undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((json) => {
        const data: CloudProviderModel[] = (json.data as any[]).map((m) => ({
          id: m.id,
          name: m.name ?? m.id,
          provider: m.provider ?? provider,
          quality: m.quality ?? 0,
        }));
        setModels(data);
        try {
          sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
        } catch {
          // ignore storage errors
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [provider, apiKey, baseUrl]);

  return { models, loading, error };
}

