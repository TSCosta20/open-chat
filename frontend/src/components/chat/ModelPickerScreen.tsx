"use client";

import { useState } from "react";
import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { useCachedModels } from "@/hooks/useCachedModels";
import { AVAILABLE_MODELS, type ModelDef } from "@/types";

const PAGE_SIZE = 6;

interface Props {
  chatId: string;
}

export function ModelPickerScreen({ chatId }: Props) {
  const modelReady = useChatStore((s) => s.modelReady);
  const progress = useChatStore((s) => s.modelLoadProgress);
  const status = useChatStore((s) => s.modelLoadStatus);
  const selectedModel = useChatStore((s) => s.getModelForChat(chatId));
  const setModelForChat = useChatStore((s) => s.setModelForChat);
  const cap = useDeviceCapability();
  const { loadModel } = useWebLLM();
  const cachedModels = useCachedModels();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  if (modelReady) return null;

  const isNoWebGPU = cap.ready && !cap.hasWebGPU;
  const totalPages = Math.ceil(AVAILABLE_MODELS.length / PAGE_SIZE);
  const pageModels = AVAILABLE_MODELS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function handleLoad() {
    setLoading(true);
    await loadModel(selectedModel);
    setLoading(false);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold text-white">Choose a model</h2>
          <p className="text-sm text-slate-400">
            Models run entirely on your device. Downloaded once, cached forever.
          </p>
        </div>

        {/* No WebGPU warning */}
        {isNoWebGPU && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            WebGPU is not supported in this browser. Please use Chrome 113+ or Edge.
          </div>
        )}

        {/* Model list */}
        {!isNoWebGPU && (
          <>
            <div className="space-y-2">
              {pageModels.map((m: ModelDef) => {
                const isRecommended = cap.ready && m.id === cap.recommendedModel;
                const overBudget = cap.ready && m.vramGB > cap.estimatedVramGB * 0.85;
                const isSelected = m.id === selectedModel;
                const isCached = cachedModels.has(m.id);

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
                        <span className={clsx(
                          "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
                          isSelected ? "border-accent" : "border-slate-600"
                        )}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        </span>
                        <div>
                          <span className="text-sm font-medium text-slate-200">{m.name}</span>
                          {isCached && (
                            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                              on device
                            </span>
                          )}
                          {isRecommended && (
                            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                              recommended
                            </span>
                          )}
                          {overBudget && !isRecommended && (
                            <span className="ml-2 text-xs text-amber-400">⚠ may be slow</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">~{m.vramGB.toFixed(1)} GB VRAM</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0 || loading}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
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
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}

        {/* Load button / progress */}
        {!isNoWebGPU && (
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
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                {cachedModels.has(selectedModel) ? "Use " : "Download & load "}
                {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name ?? selectedModel}
              </button>
            )}
          </div>
        )}

        {/* Device info + page count */}
        {cap.ready && (
          <p className="text-center text-xs text-slate-600">
            Detected ~{cap.estimatedVramGB.toFixed(1)} GB VRAM · {cap.deviceMemoryGB} GB RAM
            {" · "}{AVAILABLE_MODELS.length} models available
          </p>
        )}
      </div>
    </div>
  );
}
