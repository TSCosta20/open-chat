"use client";

const OLLAMA_BASE = "http://localhost:11434";

export interface OllamaModelInfo {
  name: string;
  size: number; // bytes
}

/** Returns the list of locally installed Ollama models, or null if Ollama isn't running. */
export async function checkOllama(): Promise<OllamaModelInfo[] | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.models ?? []) as OllamaModelInfo[];
  } catch {
    return null;
  }
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
