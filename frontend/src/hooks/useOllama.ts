"use client";

const OLLAMA_BASE = "http://localhost:11434";

export interface OllamaModelInfo {
  name: string;
  size: number; // bytes
}

export type OllamaCheckResult =
  | { status: "ok"; models: OllamaModelInfo[] }
  | { status: "cors" }
  | { status: "unavailable" };

/** Returns the list of locally installed Ollama models, or a status describing why it failed. */
export async function checkOllama(): Promise<OllamaCheckResult> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { status: "unavailable" };
    const data = await res.json();
    return { status: "ok", models: (data.models ?? []) as OllamaModelInfo[] };
  } catch (e) {
    // A TypeError with "Failed to fetch" typically means CORS or network error.
    // If the server isn't running at all we also get TypeError — we can't
    // distinguish reliably in the browser, so we show CORS instructions when
    // the page is not on localhost (most likely culprit in that case).
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");
    if (!isLocalhost && e instanceof TypeError) {
      return { status: "cors" };
    }
    return { status: "unavailable" };
  }
}

/** @deprecated use checkOllama() which returns richer status */
export async function checkOllamaSimple(): Promise<OllamaModelInfo[] | null> {
  const r = await checkOllama();
  return r.status === "ok" ? r.models : null;
}

export function useOllama() {
  async function generate(
    modelName: string,
    messages: { role: string; content: string }[],
    onToken: (t: string) => void,
  ): Promise<string> {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, messages, stream: true }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Ollama inference failed");
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const tok = parsed.message?.content ?? "";
          if (tok) {
            full += tok;
            onToken(tok);
          }
          if (parsed.done) return full;
        } catch {
          // incomplete JSON chunk — skip
        }
      }
    }

    return full;
  }

  return { generate };
}
