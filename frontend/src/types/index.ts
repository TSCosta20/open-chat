// WebLLM model IDs — must match @mlc-ai/web-llm's prebuilt model list
export type ModelId =
  | "gemma-2b-it-q4f16_1-MLC"
  | "gemma-2-2b-it-q4f16_1-MLC"
  | "gemma-2-9b-it-q4f16_1-MLC"
  | "Llama-3.2-1B-Instruct-q4f32_1-MLC"
  | "Llama-3.2-3B-Instruct-q4f32_1-MLC"
  | "Phi-3.5-mini-instruct-q4f16_1-MLC"
  | "Llama-3.1-8B-Instruct-q4f32_1-MLC"
  | "Mistral-7B-Instruct-v0.3-q4f16_1-MLC";

export interface ModelDef {
  id: ModelId;
  name: string;
  /** Approximate VRAM required in GB */
  vramGB: number;
  /** Approximate download size in GB */
  downloadGB: number;
  /** Minimum deviceMemory (navigator.deviceMemory) in GB */
  minRamGB: number;
}

export const AVAILABLE_MODELS: ModelDef[] = [
  {
    id: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    name: "Llama 3.2 1B (fastest)",
    vramGB: 1.0,
    downloadGB: 0.9,
    minRamGB: 2,
  },
  {
    id: "gemma-2b-it-q4f16_1-MLC",
    name: "Gemma 2B",
    vramGB: 1.5,
    downloadGB: 1.4,
    minRamGB: 2,
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B",
    vramGB: 1.9,
    downloadGB: 1.7,
    minRamGB: 4,
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
    name: "Llama 3.2 3B",
    vramGB: 2.0,
    downloadGB: 1.8,
    minRamGB: 4,
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini (3.8B)",
    vramGB: 2.5,
    downloadGB: 2.2,
    minRamGB: 4,
  },
  {
    id: "gemma-2-9b-it-q4f16_1-MLC",
    name: "Gemma 2 9B",
    vramGB: 6.3,
    downloadGB: 5.5,
    minRamGB: 8,
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
    name: "Llama 3.1 8B",
    vramGB: 5.0,
    downloadGB: 4.5,
    minRamGB: 8,
  },
  {
    id: "Mistral-7B-Instruct-v0.3-q4f16_1-MLC",
    name: "Mistral 7B",
    vramGB: 4.5,
    downloadGB: 4.1,
    minRamGB: 8,
  },
];

export const DEFAULT_MODEL: ModelId = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

export interface Chat {
  id: string;
  title: string;
  model: ModelId;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
