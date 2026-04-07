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

  // Determine the ModelDef for the currently selected model ID
  const allDefs = [
    CHROME_AI_MODEL,
    ...CLOUD_MODELS,
    ...TRANSFORMERS_MODELS,
    ...AVAILABLE_MODELS,
  ];
  const selectedDef = allDefs.find((m) => m.id === selectedModel);

  async function handleLoad() {
    if (!selectedDef) return;
    setLoading(true);
    try {
      if (selectedDef.backend === "chrome-ai" || selectedDef.backend === "cloud") {
        // No loading required — set ready immediately
        store.setModelReady(true);
      } else if (selectedDef.backend === "transformers") {
        await loadTransformers(selectedDef.hfModelId!);
      } else {
        // WebLLM
        await loadWebLLM(selectedModel);
      }
    } finally {
      setLoading(false);
    }
  }

  function ModelRow({ m, badge }: { m: ModelDef; badge?: React.ReactNode }) {
    const isSelected = m.id === selectedModel;
    return (
      <button
        key={m.id}
        onClick={() => !loading && setModelForChat(chatId, m.id)}
        disabled={loading}
        className={clsx(
          "w-full rounded-xl border px-4 py-3 text-left transition-colors",
          isSelected
            ? "border-accent bg-accent/10"
            : "border-surface-border bg-surface-secondary hover:border-slate-500",
          loading && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                isSelected ? "border-accent" : "border-slate-600"
              )}
            >
              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            </span>
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-sm font-medium text-slate-200">{m.name}</span>
              {badge}
              {m.fast && (
                <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400">
                  fast
                </span>
              )}
              {m.backend === "webllm" && cachedModels.has(m.id) && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                  on device
                </span>
              )}
            </div>
          </div>
          {m.vramGB > 0 && (
            <span className="text-xs text-slate-500 shrink-0 ml-2">
              ~{m.vramGB.toFixed(1)} GB
            </span>
          )}
        </div>
      </button>
    );
  }

  // ── Load button label ──────────────────────────────────────────────────────
  function loadLabel() {
    if (!selectedDef) return "Select a model";
    if (selectedDef.backend === "chrome-ai") return `Use ${selectedDef.name}`;
    if (selectedDef.backend === "cloud") return `Use ${selectedDef.name}`;
    if (selectedDef.backend === "transformers") {
      return cachedModels.has(selectedDef.hfModelId ?? "")
        ? `Use ${selectedDef.name}`
        : `Download & load ${selectedDef.name}`;
    }
    // WebLLM
    return cachedModels.has(selectedModel)
      ? `Use ${selectedDef.name}`
      : `Download & load ${selectedDef.name}`;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-white">Choose a model</h2>
          <p className="text-sm text-slate-400">
            Pick cloud for instant speed, or on-device for full privacy.
          </p>
        </div>

        {/* ── Chrome AI ─────────────────────────────────────────────────── */}
        {chromeAIStatus !== "unavailable" && (
          <section className="space-y-2">
            <SectionLabel
              icon="✦"
              title="Chrome AI"
              subtitle="Gemini Nano built into Chrome — native speed, zero download"
            />
            {chromeAIStatus === "after-download" && (
              <p className="text-xs text-amber-400 px-1">
                Chrome will download Gemini Nano in the background (one-time).
              </p>
            )}
            <ModelRow
              m={CHROME_AI_MODEL}
              badge={
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                  free · native
                </span>
              }
            />
          </section>
        )}

        {/* ── Cloud models ──────────────────────────────────────────────── */}
        <section className="space-y-2">
          <SectionLabel
            icon="☁"
            title="Cloud"
            subtitle="Fast cloud models — OpenRouter free tier or your own Gemini key"
          />
          {CLOUD_MODELS.map((m) => {
            const isGemini = m.cloudModelId?.startsWith("gemini-");
            return (
              <ModelRow
                key={m.id}
                m={m}
                badge={
                  isGemini ? (
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400">
                      own key
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                      free
                    </span>
                  )
                }
              />
            );
          })}
        </section>

        {/* ── On-device: Transformers.js ─────────────────────────────────── */}
        {!isNoWebGPU && (
          <section className="space-y-2">
            <SectionLabel
              icon="⬡"
              title="On-device · Transformers.js"
              subtitle="Runs in WebGPU via HuggingFace — private &amp; free"
            />
            {TRANSFORMERS_MODELS.map((m) => (
              <ModelRow key={m.id} m={m} />
            ))}
          </section>
        )}

        {/* ── On-device: WebLLM ─────────────────────────────────────────── */}
        {!isNoWebGPU && (
          <section className="space-y-2">
            <SectionLabel
              icon="⬡"
              title="On-device · WebLLM"
              subtitle="MLC-compiled models — large selection, WebGPU optimised"
            />
            <div className="space-y-2">
              {pageModels.map((m: ModelDef) => {
                const isRecommended = cap.ready && m.id === cap.recommendedModel;
                const overBudget = cap.ready && m.vramGB > cap.estimatedVramGB * 0.85;
                return (
                  <ModelRow
                    key={m.id}
                    m={m}
                    badge={
                      <>
                        {isRecommended && (
                          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                            recommended
                          </span>
                        )}
                        {overBudget && !isRecommended && (
                          <span className="text-xs text-amber-400">⚠ may be slow</span>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>

            {/* WebLLM pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0 || loading}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
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
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}
          </section>
        )}

        {/* No WebGPU warning */}
        {isNoWebGPU && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            WebGPU is not supported in this browser — on-device models unavailable.
            Cloud models and Chrome AI still work.
          </div>
        )}

        {/* ── Load / progress ───────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading ? (
            <>
              <div className="h-2 w-full rounded-full bg-surface-secondary overflow-hidden">
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
          <p className="text-center text-xs text-slate-600">
            ~{cap.estimatedVramGB.toFixed(1)} GB VRAM · {cap.deviceMemoryGB} GB RAM
          </p>
        )}
      </div>
    </div>
  );
}

function SectionLabel({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-0.5">
      <span className="text-slate-500 text-sm">{icon}</span>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {title}
        </span>
        <p className="text-xs text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}
