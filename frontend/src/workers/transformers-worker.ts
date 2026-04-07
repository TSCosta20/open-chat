import { pipeline, TextStreamer, env } from "@huggingface/transformers";

// Always fetch from HuggingFace Hub; cache in browser Cache API
env.allowLocalModels = false;
env.useBrowserCache = true;

type GenerateMsg = {
  type: "generate";
  id: number;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
};

type LoadMsg = {
  type: "load";
  modelId: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipe: any = null;
let loadedModelId: string | null = null;

self.onmessage = async (e: MessageEvent<LoadMsg | GenerateMsg>) => {
  const msg = e.data;

  if (msg.type === "load") {
    try {
      if (loadedModelId !== msg.modelId) {
        pipe = null;
        loadedModelId = null;

        pipe = await pipeline("text-generation", msg.modelId, {
          device: "webgpu",
          dtype: "q4f16",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          progress_callback: (info: any) => {
            self.postMessage({
              type: "progress",
              status: info.status ?? "Loading…",
              progress: typeof info.progress === "number" ? info.progress : 0,
            });
          },
        });

        loadedModelId = msg.modelId;
      }
      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }

  if (msg.type === "generate") {
    if (!pipe) {
      self.postMessage({ type: "error", message: "Model not loaded", id: msg.id });
      return;
    }

    try {
      const streamer = new TextStreamer(pipe.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (text: string) => {
          self.postMessage({ type: "token", text, id: msg.id });
        },
      });

      await pipe(msg.messages, {
        max_new_tokens: 512,
        do_sample: false,
        streamer,
      });

      self.postMessage({ type: "done", id: msg.id });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err), id: msg.id });
    }
  }
};
