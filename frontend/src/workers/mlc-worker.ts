import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// This file runs inside a Web Worker.
// It handles all model loading and inference off the main thread.
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
