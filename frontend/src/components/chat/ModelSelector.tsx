"use client";

import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { ALL_MODELS } from "@/types";

interface Props {
  chatId: string;
}

export function ModelSelector({ chatId }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const model = useChatStore((s) => (mounted ? s.getModelForChat(chatId) : ""));
  const setModelReady = useChatStore((s) => s.setModelReady);
  const cloudInUse = useChatStore((s) => s.cloudModelInUse[chatId] ?? null);
  const cloudUsage = useChatStore((s) => s.cloudUsage[chatId] ?? null);

  const modelDef = ALL_MODELS.find((m) => m.id === model);
  const isOllama = model.startsWith("ollama:");
  const name = !model
    ? "Model"
    : isOllama
      ? model.slice(7)
      : (modelDef?.name ?? model);

  const isCloud = modelDef?.backend === "cloud" || modelDef?.backend === "chrome-ai";

  function formatReset(reset: number | null | undefined): string {
    if (!mounted || !reset) return "";
    const nowSec = Date.now() / 1000;
    const tsSec = reset > 1_000_000_000 ? reset : nowSec + reset;
    const inSec = Math.max(0, Math.round(tsSec - nowSec));
    const when = new Date(tsSec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (inSec < 120) return `resets in ~${inSec}s (${when})`;
    const mins = Math.max(1, Math.round(inSec / 60));
    return `resets in ~${mins}m (${when})`;
  }

  function usageLine(kind: "requests" | "tokens"): string {
    const u = (cloudUsage as any)?.[kind];
    if (!u) return "";
    const limit = typeof u.limit === "number" ? u.limit : null;
    const remaining = typeof u.remaining === "number" ? u.remaining : null;
    const used = limit !== null && remaining !== null ? Math.max(0, limit - remaining) : null;
    const reset = formatReset(typeof u.reset === "number" ? u.reset : null);
    const parts = [
      used !== null && limit !== null ? `${used}/${limit}` : limit !== null ? `limit ${limit}` : null,
      remaining !== null ? `remaining ${remaining}` : null,
      reset || null,
    ].filter(Boolean);
    return parts.length ? `${kind}: ${parts.join(" · ")}` : "";
  }

  const title = useMemo(() => {
    if (!mounted) return "Change model";
    const resolved = cloudInUse?.label
      ? `${cloudInUse.label}${cloudInUse.provider ? ` (${cloudInUse.provider})` : ""}`
      : "";
    const titleLines = [
      "Change model",
      resolved ? `In use: ${resolved}` : null,
      usageLine("requests") || null,
      usageLine("tokens") || null,
    ].filter(Boolean);
    return titleLines.join("\n");
  }, [mounted, cloudInUse, cloudUsage]);

  return (
    <button
      onClick={() => setModelReady(false)}
      title={title}
      className="flex items-center gap-1.5 self-start rounded-lg border border-surface-border bg-surface-secondary px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-accent/60 hover:bg-white/5 hover:text-white"
    >
      {isCloud ? (
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ) : (
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
        </svg>
      )}

      <span className="max-w-[180px] truncate">{name}</span>
      {isCloud && cloudInUse?.label && (
        <span className="max-w-[160px] truncate text-[10px] text-slate-500" title={`In use: ${cloudInUse.label}`}>
          → {cloudInUse.label}
        </span>
      )}

      <svg className="h-3 w-3 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    </button>
  );
}
