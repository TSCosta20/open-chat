import { prebuiltAppConfig } from "@mlc-ai/web-llm";

export type ModelId = string;
export type Backend = "chrome-ai" | "cloud" | "transformers" | "webllm" | "ollama";

export interface ModelDef {
  id: ModelId;
  name: string;
  vramGB: number;
  minRamGB: number;
  fast?: boolean;
  backend: Backend;
  /** For cloud models: the actual model ID sent to the API. */
  cloudModelId?: string;
  /** For transformers models: the HuggingFace repo ID. */
  hfModelId?: string;
}

// ── Chrome AI (Gemini Nano built into Chrome) ─────────────────────────────────

export const CHROME_AI_MODEL: ModelDef = {
  id: "chrome-ai",
  name: "Gemini Nano (built-in)",
  vramGB: 0,
  minRamGB: 0,
  fast: true,
  backend: "chrome-ai",
};

// ── Cloud models ──────────────────────────────────────────────────────────────

export const CLOUD_MODELS: ModelDef[] = [
  // Auto-select best available model
  {
    id: "cloud:openrouter:auto",
    name: "Best available",
    vramGB: 0, minRamGB: 0,
    fast: true,
    backend: "cloud",
    cloudModelId: "openrouter:auto",
  },
  // OpenRouter free tier — needs OPENROUTER_API_KEY on server
  {
    id: "cloud:meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    vramGB: 0, minRamGB: 0,
    backend: "cloud",
    cloudModelId: "meta-llama/llama-3.3-70b-instruct:free",
  },
  {
    id: "cloud:meta-llama/llama-3.1-8b-instruct:free",
    name: "Llama 3.1 8B",
    vramGB: 0, minRamGB: 0,
    fast: true,
    backend: "cloud",
    cloudModelId: "meta-llama/llama-3.1-8b-instruct:free",
  },
  {
    id: "cloud:google/gemma-3-27b-it:free",
    name: "Gemma 3 27B",
    vramGB: 0, minRamGB: 0,
    backend: "cloud",
    cloudModelId: "google/gemma-3-27b-it:free",
  },
  {
    id: "cloud:deepseek/deepseek-r1-0528:free",
    name: "DeepSeek R1",
    vramGB: 0, minRamGB: 0,
    backend: "cloud",
    cloudModelId: "deepseek/deepseek-r1-0528:free",
  },
  // Gemini — needs GEMINI_API_KEY on server
  {
    id: "cloud:gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    vramGB: 0, minRamGB: 0,
    fast: true,
    backend: "cloud",
    cloudModelId: "gemini-2.0-flash",
  },
];

// ── Transformers.js models (WebGPU / WebNN via HuggingFace) ───────────────────

export const TRANSFORMERS_MODELS: ModelDef[] = [
  {
    id: "transformers:HuggingFaceTB/SmolLM2-360M-Instruct",
    name: "SmolLM2 360M",
    vramGB: 0.3, minRamGB: 2,
    fast: true,
    backend: "transformers",
    hfModelId: "HuggingFaceTB/SmolLM2-360M-Instruct",
  },
  {
    id: "transformers:HuggingFaceTB/SmolLM2-1.7B-Instruct",
    name: "SmolLM2 1.7B",
    vramGB: 1.1, minRamGB: 4,
    backend: "transformers",
    hfModelId: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
  },
  {
    id: "transformers:onnx-community/Qwen2.5-0.5B-Instruct",
    name: "Qwen 2.5 0.5B",
    vramGB: 0.4, minRamGB: 2,
    fast: true,
    backend: "transformers",
    hfModelId: "onnx-community/Qwen2.5-0.5B-Instruct",
  },
  {
    id: "transformers:onnx-community/Llama-3.2-1B-Instruct",
    name: "Llama 3.2 1B",
    vramGB: 0.8, minRamGB: 4,
    backend: "transformers",
    hfModelId: "onnx-community/Llama-3.2-1B-Instruct",
  },
];

// ── WebLLM models (MLC-compiled, loaded via Web Worker) ──────────────────────

const SKIP_PATTERNS = [
  /-1k$/,
  /embed/i,
  /arctic-embed/i,
  /snowflake/i,
  /Base-/i,
  /phi-1_5/i,
  /phi-2/i,
  /RedPajama/i,
  /Llama-2-13b/i,
  /Llama-3-70B/i,
  /Llama-3.1-70B/i,
];

const DISPLAY_NAMES: { match: RegExp; name: string }[] = [
  { match: /SmolLM2-135M/, name: "SmolLM2 135M (tiny)" },
  { match: /SmolLM2-360M/, name: "SmolLM2 360M" },
  { match: /SmolLM2-1.7B/, name: "SmolLM2 1.7B" },
  { match: /TinyLlama-1.1B-Chat-v1/, name: "TinyLlama 1.1B" },
  { match: /Qwen2\.5-0\.5B/, name: "Qwen 2.5 0.5B" },
  { match: /Qwen2\.5-1\.5B-Instruct/, name: "Qwen 2.5 1.5B" },
  { match: /Qwen2\.5-3B-Instruct/, name: "Qwen 2.5 3B" },
  { match: /Qwen2\.5-7B-Instruct/, name: "Qwen 2.5 7B" },
  { match: /Qwen2\.5-Coder-0\.5B/, name: "Qwen 2.5 Coder 0.5B" },
  { match: /Qwen2\.5-Coder-1\.5B/, name: "Qwen 2.5 Coder 1.5B" },
  { match: /Qwen2\.5-Coder-3B/, name: "Qwen 2.5 Coder 3B" },
  { match: /Qwen2\.5-Coder-7B/, name: "Qwen 2.5 Coder 7B" },
  { match: /Qwen2\.5-Math-1\.5B/, name: "Qwen 2.5 Math 1.5B" },
  { match: /Qwen3-0\.6B/, name: "Qwen3 0.6B" },
  { match: /Qwen3-1\.7B/, name: "Qwen3 1.7B" },
  { match: /Qwen3-4B/, name: "Qwen3 4B" },
  { match: /Qwen3-8B/, name: "Qwen3 8B" },
  { match: /gemma-2b-it/, name: "Gemma 2B" },
  { match: /gemma-2-2b-it/, name: "Gemma 2 2B" },
  { match: /gemma-2-9b-it/, name: "Gemma 2 9B" },
  { match: /Llama-3\.2-1B/, name: "Llama 3.2 1B" },
  { match: /Llama-3\.2-3B/, name: "Llama 3.2 3B" },
  { match: /Llama-3\.1-8B/, name: "Llama 3.1 8B" },
  { match: /Llama-3-8B/, name: "Llama 3 8B" },
  { match: /Llama-2-7b/, name: "Llama 2 7B" },
  { match: /Phi-3\.5-mini/, name: "Phi 3.5 Mini" },
  { match: /Phi-3-mini/, name: "Phi 3 Mini" },
  { match: /Mistral-7B-Instruct-v0\.3/, name: "Mistral 7B v0.3" },
  { match: /Mistral-7B-Instruct-v0\.2/, name: "Mistral 7B v0.2" },
  { match: /DeepSeek-R1-Distill-Qwen-7B/, name: "DeepSeek R1 Qwen 7B" },
  { match: /DeepSeek-R1-Distill-Llama-8B/, name: "DeepSeek R1 Llama 8B" },
  { match: /Hermes-3-Llama-3\.2-3B/, name: "Hermes 3 Llama 3.2 3B" },
  { match: /Hermes-3-Llama-3\.1-8B/, name: "Hermes 3 Llama 3.1 8B" },
  { match: /Hermes-2-Pro-Llama-3-8B/, name: "Hermes 2 Pro Llama 3 8B" },
  { match: /Hermes-2-Pro-Mistral-7B/, name: "Hermes 2 Pro Mistral 7B" },
  { match: /Ministral-3-3B-Instruct/, name: "Ministral 3B" },
  { match: /stablelm-2-zephyr/, name: "StableLM 2 Zephyr 1.6B" },
];

const PREFERRED_QUANT = "q4f16_1-MLC";
const FALLBACK_QUANT = "q4f32_1-MLC";

function getDisplayName(id: string): string | null {
  for (const { match, name } of DISPLAY_NAMES) {
    if (match.test(id)) return name;
  }
  return null;
}

function shouldSkip(id: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(id));
}

export const AVAILABLE_MODELS: ModelDef[] = (() => {
  const all = prebuiltAppConfig.model_list;
  const seen = new Map<string, ModelDef>();

  for (const m of all) {
    if (shouldSkip(m.model_id)) continue;
    const name = getDisplayName(m.model_id);
    if (!name) continue;

    const vramGB = (m.vram_required_MB ?? 0) / 1024;
    const minRamGB = vramGB < 2 ? 2 : vramGB < 4 ? 4 : 8;
    const fast = vramGB <= 0.5;
    const isPreferred = m.model_id.includes(PREFERRED_QUANT);
    const isFallback = m.model_id.includes(FALLBACK_QUANT);

    const existing = seen.get(name);
    if (!existing) {
      if (isPreferred || isFallback) {
        seen.set(name, { id: m.model_id, name, vramGB, minRamGB, fast, backend: "webllm" });
      }
    } else if (isPreferred && !existing.id.includes(PREFERRED_QUANT)) {
      seen.set(name, { id: m.model_id, name, vramGB, minRamGB, fast, backend: "webllm" });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.vramGB - b.vramGB);
})();

export const DEFAULT_MODEL: ModelId = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

/** All models across all backends — useful for ID lookups. */
export const ALL_MODELS: ModelDef[] = [
  CHROME_AI_MODEL,
  ...CLOUD_MODELS,
  ...TRANSFORMERS_MODELS,
  ...AVAILABLE_MODELS,
];
