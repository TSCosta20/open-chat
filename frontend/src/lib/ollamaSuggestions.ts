export interface OllamaSuggestion {
  /** Exact name to use in `ollama pull` */
  pull: string;
  /** Display name */
  label: string;
  /** Approximate size on disk / in RAM (GB) */
  sizeGB: number;
  /** One-line description */
  description: string;
  /** Release recency — higher = more recent */
  recency: number;
  /** Optional highlight tags */
  tags?: string[];
}

/**
 * Curated list of Ollama models worth trying, ordered newest-first.
 * Sizes reflect the default quantization Ollama pulls (Q4_K_M or equivalent).
 * Update this list as new models are released.
 */
export const OLLAMA_SUGGESTIONS: OllamaSuggestion[] = [
  // ── Sub-1 GB ──────────────────────────────────────────────────────────────
  {
    pull: "qwen3:0.6b",
    label: "Qwen3 0.6B",
    sizeGB: 0.5,
    description: "Alibaba's newest tiny model. Surprisingly capable for its size.",
    recency: 10,
    tags: ["fast", "multilingual"],
  },
  {
    pull: "gemma3:1b",
    label: "Gemma 3 1B",
    sizeGB: 0.8,
    description: "Google's latest 1B model. Strong reasoning for the size.",
    recency: 9,
    tags: ["fast"],
  },
  {
    pull: "smollm2:360m",
    label: "SmolLM2 360M",
    sizeGB: 0.2,
    description: "HuggingFace's ultra-small model. Fastest option available.",
    recency: 7,
    tags: ["fastest"],
  },

  // ── 1–2 GB ────────────────────────────────────────────────────────────────
  {
    pull: "qwen3:1.7b",
    label: "Qwen3 1.7B",
    sizeGB: 1.1,
    description: "Excellent quality/size ratio. Good for everyday tasks.",
    recency: 10,
    tags: ["multilingual"],
  },
  {
    pull: "smollm2:1.7b",
    label: "SmolLM2 1.7B",
    sizeGB: 1.0,
    description: "HuggingFace's efficient 1.7B model. Solid for simple tasks.",
    recency: 7,
  },
  {
    pull: "llama3.2:1b",
    label: "Llama 3.2 1B",
    sizeGB: 1.3,
    description: "Meta's compact 1B model. Good balance of speed and quality.",
    recency: 8,
  },

  // ── 2–4 GB ────────────────────────────────────────────────────────────────
  {
    pull: "qwen3:4b",
    label: "Qwen3 4B",
    sizeGB: 2.6,
    description: "Alibaba's best small model. Handles complex instructions well.",
    recency: 10,
    tags: ["multilingual", "reasoning"],
  },
  {
    pull: "gemma3:4b",
    label: "Gemma 3 4B",
    sizeGB: 2.5,
    description: "Google's 4B model with strong multilingual and coding support.",
    recency: 9,
    tags: ["coding", "multilingual"],
  },
  {
    pull: "phi4-mini",
    label: "Phi-4 Mini",
    sizeGB: 2.5,
    description: "Microsoft's compact model, optimised for reasoning tasks.",
    recency: 9,
    tags: ["reasoning"],
  },
  {
    pull: "llama3.2:3b",
    label: "Llama 3.2 3B",
    sizeGB: 2.0,
    description: "Meta's 3B model. Well-rounded, great for general use.",
    recency: 8,
  },
  {
    pull: "mistral:7b",
    label: "Mistral 7B",
    sizeGB: 4.1,
    description: "Mistral's classic 7B. Excellent instruction following.",
    recency: 6,
  },

  // ── 4–8 GB ────────────────────────────────────────────────────────────────
  {
    pull: "qwen3:8b",
    label: "Qwen3 8B",
    sizeGB: 5.2,
    description: "Alibaba's flagship 8B. Top-tier quality among local models.",
    recency: 10,
    tags: ["reasoning", "multilingual", "coding"],
  },
  {
    pull: "llama3.1:8b",
    label: "Llama 3.1 8B",
    sizeGB: 4.7,
    description: "Meta's solid 8B model. One of the most capable open models.",
    recency: 7,
    tags: ["coding"],
  },
  {
    pull: "gemma3:12b",
    label: "Gemma 3 12B",
    sizeGB: 7.3,
    description: "Google's mid-range model. Near GPT-3.5 quality.",
    recency: 9,
    tags: ["multilingual"],
  },
];

/**
 * Returns suggestions filtered to what fits within the device's RAM budget,
 * sorted by recency first (newest models at the top), then by size descending
 * (largest that fits = best quality).
 */
export function getSuggestionsForDevice(
  ramBudgetGB: number,
  installedNames: Set<string>,
): OllamaSuggestion[] {
  return OLLAMA_SUGGESTIONS
    .filter((s) => s.sizeGB * 1.5 <= ramBudgetGB)        // runtime overhead ×1.5
    .filter((s) => !installedNames.has(s.pull))           // hide already installed
    .sort((a, b) => b.recency - a.recency || b.sizeGB - a.sizeGB);
}
