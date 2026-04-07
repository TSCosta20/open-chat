"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useTransformersJS } from "@/hooks/useTransformersJS";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { useCachedModels } from "@/hooks/useCachedModels";
import { checkChromeAI, type ChromeAIStatus } from "@/hooks/useChromeAI";
import {
  AVAILABLE_MODELS,
  CLOUD_MODELS,
  TRANSFORMERS_MODELS,
  CHROME_AI_MODEL,
  type ModelDef,
} from "@/types";

const WEBLLM_PAGE_SIZE = 6;

interface Props {
  chatId: string;
}

export function ModelPickerScreen({ chatId }: Props) {
  const store = useChatStore();
  const modelReady = useChatStore((s) => s.modelReady);
  const progress = useChatStore((s) => s.modelLoadProgress);
  const status = useChatStore((s) => s.modelLoadStatus);
  const selectedModel = useChatStore((s) => s.getModelForChat(chatId));
  const setModelForChat = useChatStore((s) => s.setModelForChat);
  const cap = useDeviceCapability();
  const { loadModel: loadWebLLM } = useWebLLM();
  const { loadModel: loadTransformers } = useTransformersJS();
  const cachedModels = useCachedModels();

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [chromeAIStatus, setChromeAIStatus] = useState<ChromeAIStatus>("unavailable");

  useEffect(() => {
    checkChromeAI().then(setChromeAIStatus);
  }, []);

  if (modelReady) return null;

  const isNoWebGPU = cap.ready && !cap.hasWebGPU;
  const totalPages = Math.ceil(AVAILABLE_MODELS.length / WEBLLM_PAGE_SIZE);
  const pageModels = AVAILABLE_MODELS.slice(
    page * WEBLLM_PAGE_SIZE,
    (page + 1) * WEBLLM_PAGE_SIZE
  );

  const allDefs = [CHROME_AI_MODEL, ...CLOUD_MODELS, ...TRANSFORMERS_MODELS, ...AVAILABLE_MODELS];
  const selectedDef = allDefs.find((m) => m.id === selectedModel);

  async function handleLoad() {
    if (!selectedDef) return;
    setLoading(true);
    try {
      if (selectedDef.backend === "chrome-ai" || selectedDef.backend === "cloud") {
        store.setModelReady(true);
      } else if (selectedDef.backend === "transformers") {
        await loadTransformers(selectedDef.hfModelId!);
      } else {
        await loadWebLLM(selectedModel);
      }
    } finally {
      setLoading(false);
    }
  }

  function loadLabel() {
    if (!selectedDef) return "Select a model";
    if (selectedDef.backend === "chrome-ai" || selectedDef.backend === "cloud")
      return `Use ${selectedDef.name}`;
    return cachedModels.has(selectedDef.hfModelId ?? selectedModel)
      ? `Use ${selectedDef.name}`
      : `Download & load ${selectedDef.name}`;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-white mb-1">Choose a model</h2>
          <p className="text-sm text-slate-400">
            Cloud for instant responses · On-device for privacy
          </p>
        </div>

        <div className="space-y-5">

          {/* ── Chrome AI ─────────────────────────────────────────────── */}
          {chromeAIStatus !== "unavailable" && (
            <div>
              <SectionHeading title="Chrome AI" />
              {chromeAIStatus === "after-download" && (
                <p className="text-xs text-amber-400 mb-2 px-1">
                  Chrome will download Gemini Nano once in the background.
                </p>
              )}
              <ModelRow
                m={CHROME_AI_MODEL}
                selected={selectedModel === CHROME_AI_MODEL.id}
                disabled={loading}
                onSelect={() => !loading && setModelForChat(chatId, CHROME_AI_MODEL.id)}
                extraBadges={
                  <Badge color="green">native · free</Badge>
                }
              />
            </div>
          )}

          {/* ── Cloud ─────────────────────────────────────────────────── */}
          <div>
            <SectionHeading title="Cloud" />
            <div className="space-y-2">
              {CLOUD_MODELS.map((m) => {
                const isGemini = m.cloudModelId?.startsWith("gemini-");
                return (
                  <ModelRow
                    key={m.id}
                    m={m}
                    selected={selectedModel === m.id}
                    disabled={loading}
                    onSelect={() => !loading && setModelForChat(chatId, m.id)}
                    extraBadges={
                      isGemini
                        ? <Badge color="blue">own key</Badge>
                        : <Badge color="green">free</Badge>
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* ── On-device: Transformers.js ────────────────────────────── */}
          {!isNoWebGPU && (
            <div>
              <SectionHeading title="On-device · Transformers.js" />
              <div className="space-y-2">
                {TRANSFORMERS_MODELS.map((m) => (
                  <ModelRow
                    key={m.id}
                    m={m}
                    selected={selectedModel === m.id}
                    disabled={loading}
                    onSelect={() => !loading && setModelForChat(chatId, m.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── On-device: WebLLM ─────────────────────────────────────── */}
          {!isNoWebGPU && (
            <div>
              <SectionHeading title="On-device · WebLLM" />
              <div className="space-y-2">
                {pageModels.map((m: ModelDef) => {
                  const isRecommended = cap.ready && m.id === cap.recommendedModel;
                  const overBudget = cap.ready && m.vramGB > cap.estimatedVramGB * 0.85;
                  return (
                    <ModelRow
                      key={m.id}
                      m={m}
                      selected={selectedModel === m.id}
                      disabled={loading}
                      onSelect={() => !loading && setModelForChat(chatId, m.id)}
                      extraBadges={
                        <>
                          {cachedModels.has(m.id) && <Badge color="green">on device</Badge>}
                          {isRecommended && <Badge color="accent">recommended</Badge>}
                          {overBudget && !isRecommended && (
                            <span className="text-xs text-amber-400">⚠ may be slow</span>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0 || loading}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                    Prev
                  </button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        disabled={loading}
                        className={clsx(
                          "h-2 rounded-full transition-all",
                          i === page ? "w-5 bg-accent" : "w-2 bg-slate-600 hover:bg-slate-400"
                        )}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages - 1 || loading}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No WebGPU warning */}
          {isNoWebGPU && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              WebGPU is not supported — on-device models unavailable. Cloud models still work.
            </div>
          )}

          {/* Load button / progress */}
          <div className="pt-2 space-y-3">
            {loading ? (
              <>
                <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span className="truncate">{status}</span>
                  <span className="shrink-0 ml-2">{progress}%</span>
                </div>
              </>
            ) : (
              <button
                onClick={handleLoad}
                disabled={!selectedDef}
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadLabel()}
              </button>
            )}
          </div>

          {/* Device info */}
          {cap.ready && (
            <p className="text-center text-xs text-slate-600 pb-2">
              ~{cap.estimatedVramGB.toFixed(1)} GB VRAM · {cap.deviceMemoryGB} GB RAM
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2 px-1">
      {title}
    </p>
  );
}

function ModelRow({
  m,
  selected,
  disabled,
  onSelect,
  extraBadges,
}: {
  m: ModelDef;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  extraBadges?: React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={clsx(
        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
        selected
          ? "border-accent bg-accent/10"
          : "border-surface-border bg-surface-secondary hover:border-slate-500",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Radio dot */}
        <span
          className={clsx(
            "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
            selected ? "border-accent" : "border-slate-600"
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
        </span>

        {/* Name + badges */}
        <div className="flex-1 flex items-center flex-wrap gap-1.5 min-w-0">
          <span className="text-sm font-medium text-slate-200">{m.name}</span>
          {m.fast && <Badge color="yellow">fast</Badge>}
          {extraBadges}
        </div>

        {/* Size hint */}
        {m.vramGB > 0 && (
          <span className="text-xs text-slate-500 shrink-0">~{m.vramGB.toFixed(1)} GB</span>
        )}
      </div>
    </button>
  );
}

function Badge({
  color,
  children,
}: {
  color: "green" | "yellow" | "blue" | "accent";
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        color === "green" && "bg-emerald-500/15 text-emerald-400",
        color === "yellow" && "bg-yellow-500/15 text-yellow-400",
        color === "blue" && "bg-blue-500/15 text-blue-400",
        color === "accent" && "bg-accent/20 text-accent"
      )}
    >
      {children}
    </span>
  );
}
