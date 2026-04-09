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
import { getSuggestionsForDevice } from "@/lib/ollamaSuggestions";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useCloudProviderModels } from "@/hooks/useCloudProviderModels";
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
  const [tab, setTab]                   = useState<Tab>(pickerLocalOnly ? "transformers" : "cloud");
  const [chromeStatus, setChromeStatus] = useState<ChromeAIStatus>("unavailable");
  const [ollamaResult, setOllamaResult] = useState<OllamaCheckResult | "loading">("loading");
  const {
    openRouterKey,
    geminiKey,
    groqKey,
    togetherKey,
    fireworksKey,
    huggingFaceKey,
    puterKey,
    routerKey,
    routerBaseUrl,
    saveOpenRouterKey,
    saveGeminiKey,
    saveGroqKey,
    saveTogetherKey,
    saveFireworksKey,
    saveHuggingFaceKey,
    savePuterKey,
    saveRouterKey,
    saveRouterBaseUrl,
  } = useApiKeys();
  const { models: orModels, loading: orLoading, error: orError } = useOpenRouterModels();
  const [orDraft, setOrDraft]           = useState("");
  const [geminiDraft, setGeminiDraft]   = useState("");
  const [groqDraft, setGroqDraft]       = useState("");
  const [togetherDraft, setTogetherDraft] = useState("");
  const [fireworksDraft, setFireworksDraft] = useState("");
  const [hfDraft, setHfDraft]           = useState("");
  const [puterDraft, setPuterDraft]     = useState("");
  const [routerKeyDraft, setRouterKeyDraft] = useState("");
  const [routerUrlDraft, setRouterUrlDraft] = useState("");
  const [orSaved, setOrSaved]           = useState(false);
  const [geminiSaved, setGeminiSaved]   = useState(false);
  const [groqSaved, setGroqSaved]       = useState(false);
  const [togetherSaved, setTogetherSaved] = useState(false);
  const [fireworksSaved, setFireworksSaved] = useState(false);
  const [hfSaved, setHfSaved]           = useState(false);
  const [puterSaved, setPuterSaved]     = useState(false);
  const [routerSaved, setRouterSaved]   = useState(false);

  const { models: puterModels, loading: puterLoading, error: puterError } = useCloudProviderModels({ provider: "puter", apiKey: puterKey });
  const { models: hfModels, loading: hfLoading, error: hfError } = useCloudProviderModels({ provider: "huggingface", apiKey: huggingFaceKey });
  const { models: groqModels, loading: groqLoading, error: groqError } = useCloudProviderModels({ provider: "groq", apiKey: groqKey });
  const { models: togetherModels, loading: togetherLoading, error: togetherError } = useCloudProviderModels({ provider: "together", apiKey: togetherKey });
  const { models: fireworksModels, loading: fireworksLoading, error: fireworksError } = useCloudProviderModels({ provider: "fireworks", apiKey: fireworksKey });
  const { models: routerModels, loading: routerLoading, error: routerError } = useCloudProviderModels({ provider: "router", apiKey: routerKey, baseUrl: routerBaseUrl });

  useEffect(() => { checkChromeAI().then(setChromeStatus); }, []);
  useEffect(() => { checkOllama().then(setOllamaResult); }, []);

  if (modelReady) return null;

  const bestAvailable = CLOUD_MODELS.find((m) => m.id === "cloud:auto");
  const hasAnyCloudKey =
    !!openRouterKey ||
    !!geminiKey ||
    !!groqKey ||
    !!togetherKey ||
    !!fireworksKey ||
    !!huggingFaceKey ||
    !!puterKey ||
    !!routerKey;

  const isNoWebGPU  = cap.ready && !cap.hasWebGPU;
  const ollamaList  = ollamaResult !== "loading" && ollamaResult.status === "ok" ? ollamaResult.models : [];
  const allDefs     = [CHROME_AI_MODEL, ...CLOUD_MODELS, ...TRANSFORMERS_MODELS, ...AVAILABLE_MODELS];
  // For Ollama, selectedDef may not be in allDefs — detect by prefix
  const isOllamaSelected = selectedModel.startsWith("ollama:");
  // For dynamic OpenRouter models not in the static list
  const isDynamicCloudSelected = selectedModel.startsWith("cloud:") && !allDefs.find((m) => m.id === selectedModel);
  const selectedDef = (isOllamaSelected || isDynamicCloudSelected)
    ? undefined
    : allDefs.find((m) => m.id === selectedModel);

  async function handleLoad() {
    if (!selectedModel || (!selectedDef && !isOllamaSelected && !isDynamicCloudSelected)) return;
    setLoading(true);
    try {
      if (isOllamaSelected || isDynamicCloudSelected) {
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
    if (isDynamicCloudSelected) {
      const raw = selectedModel.slice(6);
      const orDef = orModels.find((m) => m.id === raw);
      if (orDef) return `Use ${orDef.name}`;

      const colon = raw.indexOf(":");
      if (colon > 0) {
        const provider = raw.slice(0, colon);
        const id = raw.slice(colon + 1);
        const byProvider: Record<string, Array<{ id: string; name: string }>> = {
          puter: puterModels,
          huggingface: hfModels,
          groq: groqModels,
          together: togetherModels,
          fireworks: fireworksModels,
          router: routerModels,
        };
        const list = byProvider[provider];
        const found = list?.find((m) => m.id === id);
        if (found) return `Use ${found.name}`;
      }

      return "Use selected model";
    }
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
    <div className="flex flex-1 flex-col items-center justify-start p-4 overflow-y-auto">
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
              {/* Chrome AI (Gemini Nano built-in) */}
              {chromeStatus !== "unavailable" && (
                <ModelRow
                  m={CHROME_AI_MODEL}
                  selected={selectedModel === CHROME_AI_MODEL.id}
                  disabled={loading}
                  onSelect={() => setModelForChat(chatId, CHROME_AI_MODEL.id)}
                  badge={<Pill green>built-in · free</Pill>}
                />
              )}

              {/* Best Available auto-select */}
              {!!bestAvailable && (
                <ModelRow
                  m={bestAvailable}
                  selected={selectedModel === bestAvailable.id}
                  disabled={loading || !hasAnyCloudKey}
                  onSelect={() => setModelForChat(chatId, bestAvailable.id)}
                  badge={hasAnyCloudKey ? <Pill accent>auto</Pill> : <Pill blue>add a key</Pill>}
                />
              )}

              {/* Gemini (own key) */}
              {CLOUD_MODELS.filter((m) => m.cloudModelId?.startsWith("gemini-")).map((m) => (
                <ModelRow
                  key={m.id}
                  m={m}
                  selected={selectedModel === m.id}
                  disabled={loading}
                  onSelect={() => setModelForChat(chatId, m.id)}
                  badge={geminiKey ? <Pill green>key saved</Pill> : <Pill blue>own key</Pill>}
                />
              ))}

              {/* Divider */}
              <div className="px-4 py-2 bg-black/20 flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  OpenRouter free models
                </p>
                {!openRouterKey && (
                  <span className="text-[10px] text-yellow-500">— key required</span>
                )}
              </div>

              {/* Dynamic OpenRouter free models */}
              {orLoading ? (
                <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Loading models from OpenRouter…
                </div>
              ) : orError ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  Could not load model list — check your connection.
                </div>
              ) : orModels.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">No free models found.</div>
              ) : (() => {
                // Group by provider
                const groups = new Map<string, typeof orModels>();
                for (const m of orModels) {
                  const g = groups.get(m.provider) ?? [];
                  g.push(m);
                  groups.set(m.provider, g);
                }

                const providerEntries = Array.from(groups.entries()).map(([provider, models]) => {
                  const bestQuality = models.reduce((best, mm) => Math.max(best, mm.quality ?? 0), 0);
                  const sorted = [...models].sort((a, b) => {
                    const qa = a.quality ?? 0;
                    const qb = b.quality ?? 0;
                    if (qa !== qb) return qb - qa;
                    if (a.hasRequestLimits !== b.hasRequestLimits) return a.hasRequestLimits ? 1 : -1;
                    if (a.contextLength !== b.contextLength) return b.contextLength - a.contextLength;
                    return a.name.localeCompare(b.name);
                  });
                  return { provider, models: sorted, bestQuality };
                });

                providerEntries.sort((a, b) => {
                  if (a.bestQuality !== b.bestQuality) return b.bestQuality - a.bestQuality;
                  return providerLabel(a.provider).localeCompare(providerLabel(b.provider));
                });

                return providerEntries.map(({ provider, models }) => (
                  <div key={provider}>
                    <div className="px-4 py-1.5 bg-black/10 border-b border-surface-border">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {providerLabel(provider)}
                      </span>
                    </div>
                    {models.map((m) => {
                      const modelId = `cloud:${m.id}`;
                      const ctx = m.contextLength >= 1000
                        ? `${Math.round(m.contextLength / 1000)}k ctx`
                        : "";
                      return (
                        <button
                          key={m.id}
                          onClick={() => setModelForChat(chatId, modelId)}
                          disabled={loading || !openRouterKey}
                          className={clsx(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            selectedModel === modelId ? "bg-accent/15" : "bg-surface-secondary hover:bg-white/5",
                            (loading || !openRouterKey) && "cursor-not-allowed opacity-50"
                          )}
                        >
                          <span className={clsx(
                            "h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                            selectedModel === modelId ? "border-accent" : "border-slate-600"
                          )}>
                            {selectedModel === modelId && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                          </span>
                          <span className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-sm text-slate-200 font-medium truncate">{m.name}</span>
                            {m.hasRequestLimits
                              ? <Pill yellow>limited</Pill>
                              : <Pill green>free</Pill>}
                          </span>
                          {ctx && <span className="text-xs text-slate-600 shrink-0">{ctx}</span>}
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}

              {/* OpenAI-compatible providers */}
              {renderCompatProviderSection({
                title: "Puter",
                provider: "puter",
                selectedModelId: selectedModel,
                uiDisabled: loading,
                models: puterModels,
                loading: puterLoading,
                error: puterError,
                hasKey: !!puterKey,
                noteWhenNoKey: "— auth token required",
                onSelect: (id) => setModelForChat(chatId, `cloud:puter:${id}`),
              })}

              {renderCompatProviderSection({
                title: "Hugging Face Inference API",
                provider: "huggingface",
                selectedModelId: selectedModel,
                uiDisabled: loading,
                models: hfModels,
                loading: hfLoading,
                error: hfError,
                hasKey: !!huggingFaceKey,
                noteWhenNoKey: "— token required",
                onSelect: (id) => setModelForChat(chatId, `cloud:huggingface:${id}`),
              })}

              {renderCompatProviderSection({
                title: "Groq",
                provider: "groq",
                selectedModelId: selectedModel,
                uiDisabled: loading,
                models: groqModels,
                loading: groqLoading,
                error: groqError,
                hasKey: !!groqKey,
                noteWhenNoKey: "— key required",
                onSelect: (id) => setModelForChat(chatId, `cloud:groq:${id}`),
              })}

              {renderCompatProviderSection({
                title: "Together AI",
                provider: "together",
                selectedModelId: selectedModel,
                uiDisabled: loading,
                models: togetherModels,
                loading: togetherLoading,
                error: togetherError,
                hasKey: !!togetherKey,
                noteWhenNoKey: "— key required",
                onSelect: (id) => setModelForChat(chatId, `cloud:together:${id}`),
              })}

              {renderCompatProviderSection({
                title: "Fireworks AI",
                provider: "fireworks",
                selectedModelId: selectedModel,
                uiDisabled: loading,
                models: fireworksModels,
                loading: fireworksLoading,
                error: fireworksError,
                hasKey: !!fireworksKey,
                noteWhenNoKey: "— key required",
                onSelect: (id) => setModelForChat(chatId, `cloud:fireworks:${id}`),
              })}

              {renderCompatProviderSection({
                title: "Multi-model router",
                provider: "router",
                selectedModelId: selectedModel,
                uiDisabled: loading,
                models: routerModels,
                loading: routerLoading,
                error: routerError,
                hasKey: !!routerKey && !!routerBaseUrl,
                noteWhenNoKey: "— base URL + key required",
                onSelect: (id) => setModelForChat(chatId, `cloud:router:${id}`),
              })}
            </>}

            {/* ── Transformers.js ────────────────────────────────── */}
            {tab === "transformers" && <>
              {cap.ready && cap.isLowEnd && (
                <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                  Your device has a low-end GPU (~{cap.estimatedVramGB.toFixed(1)} GB VRAM). Only very small models are allowed. <strong className="text-amber-200">Cloud is recommended</strong> for best results.
                </div>
              )}
              {isNoWebGPU
                ? <NoWebGPU />
                : TRANSFORMERS_MODELS.map((m) => {
                    const heavy = cap.ready && m.vramGB > cap.vramBudgetGB;
                    return (
                      <ModelRow
                        key={m.id}
                        m={m}
                        selected={selectedModel === m.id}
                        disabled={loading}
                        tooHeavy={heavy}
                        onSelect={() => setModelForChat(chatId, m.id)}
                        badge={heavy ? <Pill red>too heavy</Pill> : undefined}
                      />
                    );
                  })
              }
            </>}

            {/* ── WebLLM ─────────────────────────────────────────── */}
            {tab === "webllm" && <>
              {cap.ready && cap.isLowEnd && (
                <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                  Your device has a low-end GPU (~{cap.estimatedVramGB.toFixed(1)} GB VRAM). Only very small models are allowed. <strong className="text-amber-200">Cloud is recommended</strong> for best results.
                </div>
              )}
              {isNoWebGPU
                ? <NoWebGPU />
                : AVAILABLE_MODELS.map((m: ModelDef) => {
                    const recommended = cap.ready && m.id === cap.recommendedModel;
                    const heavy       = cap.ready && m.vramGB > cap.vramBudgetGB;
                    return (
                      <ModelRow
                        key={m.id}
                        m={m}
                        selected={selectedModel === m.id}
                        disabled={loading}
                        tooHeavy={heavy}
                        onSelect={() => setModelForChat(chatId, m.id)}
                        badge={
                          heavy                   ? <Pill red>too heavy</Pill>
                          : cachedModels.has(m.id) ? <Pill green>cached</Pill>
                          : recommended            ? <Pill accent>best</Pill>
                          : null
                        }
                      />
                    );
                  })
              }
            </>}

            {/* ── Ollama ─────────────────────────────────────────── */}
            {tab === "ollama" && <>
              {cap.ready && cap.isLowEnd && (
                <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 leading-relaxed">
                  Ollama runs on CPU. Your device's processor is likely too slow for comfortable AI responses — even small models may take a long time. <strong className="text-amber-200">Cloud is strongly recommended</strong> for this device.
                </div>
              )}
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
              ) : (() => {
                const installedNames = new Set(ollamaList.map((m) => m.name));
                const suggestions = cap.ready
                  ? getSuggestionsForDevice(cap.ramBudgetGB, installedNames)
                  : [];

                return <>
                  {/* Installed models */}
                  {ollamaList.map((m) => {
                    const modelId  = `ollama:${m.name}`;
                    const sizeGB   = m.size / 1024 ** 3;
                    const needsGB  = sizeGB * 1.5;
                    const heavy    = cap.ready && needsGB > cap.ramBudgetGB;
                    const isSelected = selectedModel === modelId;
                    return (
                      <button
                        key={m.name}
                        onClick={heavy ? undefined : () => setModelForChat(chatId, modelId)}
                        disabled={loading || heavy}
                        title={heavy ? "This model requires more RAM than your device can safely spare" : undefined}
                        className={clsx(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          isSelected ? "bg-accent/15" : "bg-surface-secondary hover:bg-white/5",
                          (loading || heavy) && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <span className={clsx(
                          "h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                          isSelected ? "border-accent" : "border-slate-600"
                        )}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        </span>
                        <span className="flex-1 flex items-center gap-2 min-w-0">
                          <span className="text-sm text-slate-200 font-medium truncate">{m.name}</span>
                          {heavy ? <Pill red>too heavy</Pill> : <Pill green>installed</Pill>}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">~{sizeGB.toFixed(1)} GB</span>
                      </button>
                    );
                  })}

                  {/* Suggestions */}
                  {suggestions.length > 0 && <>
                    <div className="px-4 py-2 bg-black/20">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {ollamaList.length === 0 ? "Models that work on your device" : "More models you can run"}
                      </p>
                    </div>
                    {suggestions.map((s) => (
                      <SuggestionRow key={s.pull} suggestion={s} />
                    ))}
                  </>}

                  {ollamaList.length === 0 && suggestions.length === 0 && (
                    <div className="px-4 py-4 text-xs text-slate-500">
                      No model suggestions available for this device.
                    </div>
                  )}
                </>;
              })()}
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

            {/* Puter */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Puter auth token</p>
                {puterKey ? <Pill green>saved</Pill> : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                OpenAI-compatible endpoint via your Puter account token.{" "}
                <a
                  href="https://puter.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  puter.com/dashboard
                </a>{" "}
                â†’ Copy auth token.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={puterKey ? "pt-â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "Paste token..."}
                  value={puterDraft}
                  onChange={(e) => { setPuterDraft(e.target.value); setPuterSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { savePuterKey(puterDraft); setPuterDraft(""); setPuterSaved(true); }}
                  disabled={!puterDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {puterSaved ? "Saved âœ“" : "Save"}
                </button>
              </div>
            </div>

            {/* Hugging Face */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Hugging Face token</p>
                {huggingFaceKey ? <Pill green>saved</Pill> : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Uses Hugging Face's OpenAI-compatible router endpoint.{" "}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  huggingface.co/settings/tokens
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={huggingFaceKey ? "hf_â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "hf_..."}
                  value={hfDraft}
                  onChange={(e) => { setHfDraft(e.target.value); setHfSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { saveHuggingFaceKey(hfDraft); setHfDraft(""); setHfSaved(true); }}
                  disabled={!hfDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {hfSaved ? "Saved âœ“" : "Save"}
                </button>
              </div>
            </div>

            {/* Groq */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Groq key</p>
                {groqKey ? <Pill green>saved</Pill> : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                OpenAI-compatible API.{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  console.groq.com/keys
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={groqKey ? "gsk_â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "gsk_..."}
                  value={groqDraft}
                  onChange={(e) => { setGroqDraft(e.target.value); setGroqSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { saveGroqKey(groqDraft); setGroqDraft(""); setGroqSaved(true); }}
                  disabled={!groqDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {groqSaved ? "Saved âœ“" : "Save"}
                </button>
              </div>
            </div>

            {/* Together */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Together key</p>
                {togetherKey ? <Pill green>saved</Pill> : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                OpenAI-compatible API.{" "}
                <a
                  href="https://api.together.xyz/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  api.together.xyz/settings/api-keys
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={togetherKey ? "together-â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "Paste key..."}
                  value={togetherDraft}
                  onChange={(e) => { setTogetherDraft(e.target.value); setTogetherSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { saveTogetherKey(togetherDraft); setTogetherDraft(""); setTogetherSaved(true); }}
                  disabled={!togetherDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {togetherSaved ? "Saved âœ“" : "Save"}
                </button>
              </div>
            </div>

            {/* Fireworks */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Fireworks key</p>
                {fireworksKey ? <Pill green>saved</Pill> : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                OpenAI-compatible API.{" "}
                <a
                  href="https://app.fireworks.ai/settings/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent-hover"
                >
                  app.fireworks.ai/settings/api-keys
                </a>
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={fireworksKey ? "fw-â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "Paste key..."}
                  value={fireworksDraft}
                  onChange={(e) => { setFireworksDraft(e.target.value); setFireworksSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => { saveFireworksKey(fireworksDraft); setFireworksDraft(""); setFireworksSaved(true); }}
                  disabled={!fireworksDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {fireworksSaved ? "Saved âœ“" : "Save"}
                </button>
              </div>
            </div>

            {/* Router (custom OpenAI-compatible) */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Multi-model router</p>
                {routerKey && routerBaseUrl ? <Pill green>saved</Pill> : <Pill blue>optional</Pill>}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Use any OpenAI-compatible endpoint (ShareAI-style routers, LiteLLM, etc.).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={routerBaseUrl ? routerBaseUrl : "Base URL (e.g. https://example.com/v1)"}
                  value={routerUrlDraft}
                  onChange={(e) => { setRouterUrlDraft(e.target.value); setRouterSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={routerKey ? "sk-â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : "API key"}
                  value={routerKeyDraft}
                  onChange={(e) => { setRouterKeyDraft(e.target.value); setRouterSaved(false); }}
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-accent"
                />
                <button
                  onClick={() => {
                    if (routerUrlDraft.trim()) saveRouterBaseUrl(routerUrlDraft);
                    if (routerKeyDraft.trim()) saveRouterKey(routerKeyDraft);
                    setRouterUrlDraft("");
                    setRouterKeyDraft("");
                    setRouterSaved(true);
                  }}
                  disabled={!routerUrlDraft.trim() && !routerKeyDraft.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-accent-hover transition-colors"
                >
                  {routerSaved ? "Saved âœ“" : "Save"}
                </button>
              </div>
            </div>

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
            disabled={
              (!selectedDef && !isOllamaSelected && !isDynamicCloudSelected) ||
              (!!selectedDef && selectedDef.backend !== "cloud" && selectedDef.backend !== "chrome-ai" && cap.ready && selectedDef.vramGB > cap.vramBudgetGB) ||
              (isOllamaSelected && cap.ready && (() => { const m = ollamaList.find(o => `ollama:${o.name}` === selectedModel); return !!m && (m.size / 1024**3) * 1.5 > cap.ramBudgetGB; })())
            }
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
            {cap.hasWebGPU
              ? `~${cap.vramBudgetGB.toFixed(1)} GB VRAM available · ${cap.deviceMemoryGB} GB RAM`
              : `${cap.deviceMemoryGB} GB RAM · no WebGPU`}
          </p>
        )}

      </div>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function ModelRow({ m, selected, disabled, tooHeavy, onSelect, badge }: {
  m: ModelDef; selected: boolean; disabled: boolean; tooHeavy?: boolean;
  onSelect: () => void; badge?: React.ReactNode;
}) {
  return (
    <button
      onClick={tooHeavy ? undefined : onSelect}
      disabled={disabled || tooHeavy}
      title={tooHeavy ? "This model requires more memory than your device has available" : undefined}
      className={clsx(
        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
        selected ? "bg-accent/15" : "bg-surface-secondary hover:bg-white/5",
        (disabled || tooHeavy) && "cursor-not-allowed opacity-50"
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

function Pill({ children, green, blue, yellow, accent, red }: {
  children: React.ReactNode;
  green?: boolean; blue?: boolean; yellow?: boolean; accent?: boolean; red?: boolean;
}) {
  return (
    <span className={clsx(
      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
      green  && "bg-emerald-500/15 text-emerald-400",
      blue   && "bg-blue-500/15 text-blue-400",
      yellow && "bg-yellow-500/15 text-yellow-400",
      accent && "bg-accent/20 text-accent",
      red    && "bg-red-500/15 text-red-400",
    )}>
      {children}
    </span>
  );
}

function SuggestionRow({ suggestion: s }: { suggestion: import("@/lib/ollamaSuggestions").OllamaSuggestion }) {
  const [copied, setCopied] = useState(false);
  const cmd = `ollama pull ${s.pull}`;

  function copy() {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-surface-secondary border-b border-surface-border last:border-0">
      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-200 font-medium">{s.label}</span>
          <span className="text-xs text-slate-500">~{s.sizeGB} GB</span>
          {s.tags?.map((t) => (
            <span key={t} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{t}</span>
          ))}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
        {/* Pull command + copy */}
        <div className="flex items-center gap-2 mt-1">
          <code className="flex-1 rounded-md bg-black/40 px-2.5 py-1.5 text-[11px] font-mono text-emerald-400 select-all truncate">
            {cmd}
          </code>
          <button
            onClick={copy}
            title="Copy command"
            className={clsx(
              "shrink-0 flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors",
              copied
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            )}
          >
            {copied ? (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Copied
              </>
            ) : (
              <>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoWebGPU() {
  return (
    <div className="px-4 py-4 text-sm text-amber-300">
      WebGPU not available — use Chrome 113+ or Edge.
    </div>
  );
}

function renderCompatProviderSection(opts: {
  title: string;
  provider: string;
  selectedModelId: string;
  uiDisabled: boolean;
  models: Array<{ id: string; name: string; quality?: number }>;
  loading: boolean;
  error: boolean;
  hasKey: boolean;
  noteWhenNoKey: string;
  onSelect: (id: string) => void;
}) {
  const provider = opts.provider.toLowerCase();

  return (
    <>
      <div className="px-4 py-2 bg-black/20 flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {opts.title}
        </p>
        {!opts.hasKey && (
          <span className="text-[10px] text-yellow-500">{opts.noteWhenNoKey}</span>
        )}
      </div>

      {!opts.hasKey ? (
        <div className="px-4 py-3 text-xs text-slate-500">
          Add a key in the Cloud section below to load models.
        </div>
      ) : opts.loading ? (
        <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-400">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading modelsâ€¦
        </div>
      ) : opts.error ? (
        <div className="px-4 py-3 text-xs text-slate-500">
          Could not load model list â€” check your key and connection.
        </div>
      ) : opts.models.length === 0 ? (
        <div className="px-4 py-3 text-xs text-slate-500">No models found.</div>
      ) : (
        [...opts.models]
          .sort((a, b) => {
            const qa = a.quality ?? 0;
            const qb = b.quality ?? 0;
            if (qa !== qb) return qb - qa;
            return (a.name ?? a.id).localeCompare(b.name ?? b.id);
          })
          .map((m) => {
            const modelId = `cloud:${provider}:${m.id}`;
            const isSelected = opts.selectedModelId === modelId;
            return (
              <button
                key={m.id}
                onClick={() => opts.onSelect(m.id)}
                disabled={opts.uiDisabled}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  isSelected ? "bg-accent/15" : "bg-surface-secondary hover:bg-white/5",
                  opts.uiDisabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span className={clsx(
                  "h-3.5 w-3.5 rounded-full border-2 shrink-0 flex items-center justify-center",
                  isSelected ? "border-accent" : "border-slate-600"
                )}>
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </span>
                <span className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-sm text-slate-200 font-medium truncate">{m.name ?? m.id}</span>
                </span>
              </button>
            );
          })
      )}
    </>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  "meta-llama":       "Meta · Llama",
  "google":           "Google",
  "deepseek":         "DeepSeek",
  "qwen":             "Alibaba · Qwen",
  "mistralai":        "Mistral AI",
  "microsoft":        "Microsoft · Phi",
  "nvidia":           "NVIDIA",
  "nousresearch":     "Nous Research",
  "cohere":           "Cohere",
  "anthropic":        "Anthropic",
  "openai":           "OpenAI",
  "x-ai":             "xAI · Grok",
  "amazon":           "Amazon",
  "01-ai":            "01.AI · Yi",
  "moonshotai":       "Moonshot AI",
  "tngtech":          "TNG Tech",
};

function providerLabel(slug: string): string {
  return PROVIDER_LABELS[slug] ?? slug.replace(/-/g, " ");
}
