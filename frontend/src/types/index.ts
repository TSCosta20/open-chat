// All model definitions are generated at runtime from @mlc-ai/web-llm.
// See src/lib/models.ts for the source of truth.
export type { ModelId, ModelDef, Backend } from "@/lib/models";
export {
  AVAILABLE_MODELS,
  CLOUD_MODELS,
  TRANSFORMERS_MODELS,
  CHROME_AI_MODEL,
  ALL_MODELS,
  DEFAULT_MODEL,
} from "@/lib/models";

export interface Chat {
  id: string;
  title: string;
  model: string;
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
