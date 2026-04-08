"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { useSession } from "next-auth/react";
import { useWebLLM } from "@/hooks/useWebLLM";
import { useTransformersJS } from "@/hooks/useTransformersJS";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { useCachedModels } from "@/hooks/useCachedModels";
import { checkChromeAI, type ChromeAIStatus } from "@/hooks/useChromeAI";
import { checkOllama, type OllamaModelInfo, type OllamaCheckResult } from "@/hooks/useOllama";
import { useApiKeys } from "@/hooks/useApiKeys";
import Link from "next/link";
import { updateChatModel } from "@/lib/api";
import {
  AVAILABLE_MODELS,
  CLOUD_MODELS,
  TRANSFORMERS_MODELS,
  CHROME_AI_MODEL,
  type ModelDef,
} from "@/types";

const WEBLLM_PAGE_SIZE = 5;
type Tab = "cloud" | "transformers" | "webllm" | "ollama";

interface Props { chatId: string }

export function ModelPickerScreen({ chatId }: Props) {
  const store = useChatStore();
  const modelReady    = useChatStore((s) => s.modelReady);
  const progress      = useChatStore((s) => s.modelLoadProgress);
  const status        = useChatStore((s) => s.modelLoadStatus);
  const selectedModel = useChatStore((s) => s.getModelForChat(chatId));
  const setModelForChat = useChatStore((s) => s.setModelForChat);
  const cap           = useDeviceCapability();
  const { loadModel: loadWebLLM }       = useWebLLM();
  const { loadModel: loadTransformers } = useTransformersJS();
  const cachedModels  = useCachedModels();

  const pickerLocalOnly = useChatStore((s) => s.pickerLocalOnly);
  const setPickerLocalOnly = useChatStore((s) => s.setPickerLocalOnly);
  const { data: session } = useSession();

  const [loading, setLoading]           = useState(false);
  const [page, setPage]                 = useState(0);
  const [tab, setTab]                   = useState<Tab>(pickerLocalOnly ? "transformers" : "cloud");
  const [chromeStatus, setChromeStatus] = useState<ChromeAIStatus>("unavailable");
  const [ollamaResult, setOllamaResult] = useState<OllamaCheckResult | "loading">("loading");
  const { openRouterKey, geminiKey, saveOpenRouterKey, saveGeminiKey } = useApiKeys();
  const [orDraft, setOrDraft]           = useState("");
  const [geminiDraft, setGeminiDraft]   = useState("");
  const [orSaved, setOrSaved]           = useState(false);
  const [geminiSaved, setGeminiSaved]   = useState(false);

  useEffect(() => { checkChromeAI().then(setChromeStatus); }, []);
  useEffect(() => { checkOllama().then(setOllamaResult); }, []);

  if (modelReady) return null;

  const isNoWebGPU  = cap.ready && !cap.hasWebGPU;
  const totalPages  = Math.ceil(AVAILABLE_MODELS.length / WEBLLM_PAGE_SIZE);
  const pageModels  = AVAILABLE_MODELS.slice(page * WEBLLM_PAGE_SIZE, (page + 1) * WEBLLM_PAGE_SIZE);
  const ollamaList  = ollamaResult !== "loading" && ollamaResult.status === "ok" ? ollamaResult.models : [];
  const allDefs     = [CHROME_AI_MODEL, ...CLOUD_MODELS, ...TRANSFORMERS_MODELS, ...AVAILABLE_MODELS];
  // For Ollama, selectedDef may not be in allDefs — detect by prefix
  const isOllamaSelected = selectedModel.startsWith("ollama:");
  const selectedDef = isOllamaSelected ? undefined : allDefs.find((m) => m.id === selectedModel);

  async function handleLoad() {
    if (!selectedModel || (!selectedDef && !isOllamaSelected)) return;
    setLoading(true);
    try {
      if (isOllamaSelected) {
        store.setModelReady(true);
      } else if (selectedDef!.backend === "chrome-ai" || selectedDef!.backend === "cloud") {
        store.setModelReady(true);
      } else if (selectedDef!.backend === "transformers") {
        await loadTransformers(selectedDef!.hfModelId!);
      } else {
        await loadWebLLM(selectedModel);
      }
      setPickerLocalOnly(false);
      // Persist model choice to backend so other devices see the same model
      updateChatModel(chatId, selectedModel, session?.backendToken);
    } finally {
      setLoading(false);
    }
  }

  function loadLabel() {
    if (isOllamaSelected) return `Use ${selectedModel.slice(7)}`;
    if (!selectedDef) return "Select a model above";
    if (selectedDef.backend === "chrome-ai" || selectedDef.backend === "cloud")
      return `Use ${selectedDef.name}`;
    const cached = cachedModels.has(selectedDef.hfModelId ?? selectedModel);
    return cached ? `Use ${selectedDef.name}` : `Download & use ${selectedDef.name}`;
  }

  const TABS: { id: Tab; label: string }[] = [
    ...(!pickerLocalOnly ? [{ id: "cloud" as Tab, label: "Cloud" }] : []),
    { id: "transformers", label: "Transformers.js" },
    { id: "webllm",       label: "WebLLM" },
    { id: "ollama",       label: "Ollama" },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="w-full max-w-md flex flex-col gap-3">

        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white">Choose a model</h2>
          <p className="text-xs text-slate-400 mt-0.5">Cloud = instant · On-device = private &amp; free</p>
        </div>

        {/* Tab bar */}
        <div className="flex rounded-xl bg-white/5 p-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              disabled={loading}
              className={clsx(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
                tab === t.id
                  ? "bg-accent text-white shadow"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Model list — fixed height, scrolls internally */}
        <div className="rounded-xl border border-surface-border overflow-hidden">
          <div className="overflow-y-auto max-h-64 divide-y divide-surface-border">

            {/* ── Cloud ──────────────────────────────────────────── */}
            {tab === "cloud" && <>
              {chromeStatus !== "unavailable" && (
                <ModelRow
                  m={CHROME_AI_MODEL}
                  selected={selectedModel === CHROME_AI_MODEL.id}
                  disabled={loading}
                  onSelect={() => setModelForChat(chatId, CHROME_AI_MODEL.id)}
                  badge={<Pill green>native · free</Pill>}
                />
              )}
              {CLOUD_MODELS.map((m) => {
                const isGemini = m.cloudModelId?.startsWith("gemini-");
                const hasKey = isGemini ? !!geminiKey : !!openRouterKey;
                return (
                  <ModelRow
                    key={m.id}
                    m={m}
                    selected={selectedModel === m.id}
                    disabled={loading}
                    onSelect={() => setModelForChat(chatId, m.id)}
                    badge={
                      hasKey
                        ? <Pill green>key saved</Pill>
                        : isGemini
                        ? <Pill blue>own key</Pill>
                        : <Pill yellow>key needed</Pill>
                    }
                  />
                );
              })}
            </>}

            {/* ── Transformers.js ────────────────────────────────── */}
            {tab === "transformers" && <>
              {isNoWebGPU
                ? <NoWebGPU />
                : TRANSFORMERS_MODELS.map((m) => (
                    <ModelRow
                      key={m.id}
                      m={m}
                      selected={selectedModel === m.id}
                      disabled={loading}
                      onSelect={() => setModelForChat(chatId, m.id)}
                    />
                  ))
              }
            </>}

            {/* ── WebLLM ─────────────────────────────────────────── */}
            {tab === "webllm" && <>
              {isNoWebGPU
                ? <NoWebGPU />
                : pageModels.map((m: ModelDef) => {
                    const recommended = cap.ready && m.id === cap.recommendedModel;
                    const overBudget  = cap.ready && m.vramGB > cap.estimatedVramGB * 0.85;
                    return (
                      <ModelRow
                        key={m.id}
                        m={m}
                        selected={selectedModel === m.id}
                        disabled={loading}
                        onSelect={() => setModelForChat(chatId, m.id)}
                        badge={
                          cachedModels.has(m.id)  ? <Pill green>cached</Pill>
                          : recommended           ? <Pill accent>best</Pill>
                          : overBudget            ? <span className="text-[10px] text-amber-400">⚠ slow</span>
                          : null
                        }
                      />
                    );
                  })
              }
            </>}

            {/* ── Ollama ─────────────────────────────────────────── */}
            {tab === "ollama" && <>
              {ollamaResult === "loading" ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Detecting Ollama…
                </div>
              ) : ollamaResult.status === "cors" ? (
                <div className="px-4 py-4 space-y-2">
                  <p className="text-sm text-amber-300 font-medium">Ollama is running but blocked by CORS</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ollama needs to allow this page's origin. Restart Ollama with:
                  </p>
                  <code className="block bg-black/40 rounded-lg px-3 py-2 text-xs text-emerald-300 font-mono select-all">
                    OLLAMA_ORIGINS="*" ollama serve
                  </code>
                  <p className="text-xs text-slate-500">
                    On Windows, set the environment variable in System Settings → Environment Variables, then restart Ollama from the taskbar.
                  </p>
                  <button
                    onClick={() => { setOllamaResult("loading"); checkOllama().then(setOllamaResult); }}
                    className="text-xs text-accent underline"
                  >
                    Retry
                  </button>
                </div>
              ) : ollamaResult.status === "unavailable" ? (
                <div className="px-4 py-4 space-y-2">
                  <p className="text-sm text-amber-300 font-medium">Ollama not detected</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Install from{" "}
                    <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">ollama.com</a>
                    , then run a model:
                  </p>
                  <code className="block bg-black/40 rounded-lg px-3 py-2 text-xs text-emerald-300 font-mono">
                    ollama run llama3.2
                  </code>
                  <button
                    onClick={() => { setOllamaResult("loading"); checkOllama().then(setOllamaResult); }}
                    className="text-xs text-accent underline"
                  >
                    Retry
                  </button>
                </div>
              ) : ollamaList.length === 0 ? (
                <div className="px-4 py-4 space-y-1">
                  <p className="text-sm text-slate-300 font-medium">Ollama is running — no models yet</p>
                  <p className="text-xs text-slate-500">
                    Pull a model:{" "}
                    <code className="bg-black/30 px-1 rounded text-slate-300">ollama pull llama3.2</code>
                  </p>
                </div>
              ) : (
                ollamaList.map((m) => {
                  const modelId = `ollama:${m.name}`;
                  const sizeGB = (m.size / 1024 ** 3).toFixed(1);
                  return (
                    <button
                      key={m.name}
                      onClick={() => setModelForChat(chatId, modelId)}
                      disabled={loading}
                      className={clsx(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        selectedModel === modelId ? "bg-accent/15" : "bg-surface-secondary hover:bg-white/5",
                        loading && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <span className={clsx(
                        "h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                        selectedModel === modelId ? "border-accent" : "border-slate-600"
                      )}>
                        {selectedModel === modelId && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      </span>
                      <span className="flex-1 flex items-center gap-2 min-w-0">
                        <span className="text-sm text-slate-200 font-medium truncate">{m.name}</span>
                        <Pill green>local</Pill>
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">~{sizeGB} GB</span>
                    </button>
                  );
                })
              )}
            </>}

          </div>
        </div>

        {/* ── API Key setup — shown on Cloud tab ────────────────────── */}
        {tab === "cloud" && (
          <div className="rounded-xl border border-surface-border bg-surface-secondary divide-y divide-surface-border overflow-hidden">

            {/* OpenRouter */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">OpenRouter key</p>
                {openRouterKey
                  ? <Pill green>saved</Pill>
                  : <Pill yellow>required for free models</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Free — no credit card needed.{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  openrouter.ai/keys
                </a>{" "}
                → Sign in → Create key → copy it below.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={openRouterKey ? "sk-or-••••••••" : "sk-or-..."}
                  value={orDraft}
                  onChange={(e) => { setOrDraft(e.target.value); setOrSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { saveOpenRouterKey(orDraft); setOrDraft(""); setOrSaved(true); }}
                  disabled={!orDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {orSaved ? "Saved ✓" : "Save"}
                </button>
              </div>
            </div>

            {/* Gemini */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Gemini key</p>
                {geminiKey
                  ? <Pill green>saved</Pill>
                  : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                1,500 free requests/day.{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  aistudio.google.com/app/apikey
                </a>{" "}
                → Get API key → copy it below.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={geminiKey ? "AIza••••••••" : "AIza..."}
                  value={geminiDraft}
                  onChange={(e) => { setGeminiDraft(e.target.value); setGeminiSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { saveGeminiKey(geminiDraft); setGeminiDraft(""); setGeminiSaved(true); }}
                  disabled={!geminiDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {geminiSaved ? "Saved ✓" : "Save"}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* WebLLM pagination — only shown on webllm tab */}
        {tab === "webllm" && !isNoWebGPU && totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || loading}
              className="text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Prev
            </button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={clsx("h-1.5 rounded-full transition-all", i === page ? "w-4 bg-accent" : "w-1.5 bg-slate-600")}
                />
              ))}
            </div>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages - 1 || loading}
              className="text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}

        {/* CTA */}
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span className="truncate">{status}</span>
              <span className="shrink-0 ml-2">{progress}%</span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleLoad}
            disabled={!selectedDef && !isOllamaSelected}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loadLabel()}
          </button>
        )}

        <p className="text-center text-[11px] text-slate-600">
          Not sure where to start?{" "}
          <Link href="/setup" className="text-accent underline hover:text-accent-hover">
            Step-by-step setup guide
          </Link>
        </p>

        {cap.ready && (
          <p className="text-center text-[11px] text-slate-600">
            ~{cap.estimatedVramGB.toFixed(1)} GB VRAM · {cap.deviceMemoryGB} GB RAM
          </p>
        )}

      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function ModelRow({ m, selected, disabled, onSelect, badge }: {
  m: ModelDef; selected: boolean; disabled: boolean;
  onSelect: () => void; badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={clsx(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        selected ? "bg-accent/15" : "bg-surface-secondary hover:bg-white/5",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      {/* Radio */}
      <span className={clsx(
        "h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
        selected ? "border-accent" : "border-slate-600"
      )}>
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </span>

      {/* Label */}
      <span className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-sm text-slate-200 font-medium truncate">{m.name}</span>
        {m.fast && <Pill yellow>fast</Pill>}
        {badge}
      </span>

      {/* Size */}
      {m.vramGB > 0 && (
        <span className="text-xs text-slate-500 shrink-0">~{m.vramGB.toFixed(1)} GB</span>
      )}
    </button>
  );
}

function Pill({ children, green, blue, yellow, accent }: {
  children: React.ReactNode;
  green?: boolean; blue?: boolean; yellow?: boolean; accent?: boolean;
}) {
  return (
    <span className={clsx(
      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
      green  && "bg-emerald-500/15 text-emerald-400",
      blue   && "bg-blue-500/15 text-blue-400",
      yellow && "bg-yellow-500/15 text-yellow-400",
      accent && "bg-accent/20 text-accent",
    )}>
      {children}
    </span>
  );
}

function NoWebGPU() {
  return (
    <div className="px-4 py-4 text-sm text-amber-300">
      WebGPU not available — use Chrome 113+ or Edge.
    </div>
  );
}
