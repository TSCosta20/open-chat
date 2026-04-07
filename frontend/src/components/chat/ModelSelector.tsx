"use client";

import { useChatStore } from "@/store/useChatStore";
import { ALL_MODELS } from "@/types";

interface Props {
  chatId: string;
}

export function ModelSelector({ chatId }: Props) {
  const model = useChatStore((s) => s.getModelForChat(chatId));
  const setModelReady = useChatStore((s) => s.setModelReady);
  const modelDef = ALL_MODELS.find((m) => m.id === model);

  const name = modelDef?.name ?? model;
  const isCloud = modelDef?.backend === "cloud" || modelDef?.backend === "chrome-ai";

  return (
    <button
      onClick={() => setModelReady(false)}
      title="Change model"
      className="flex items-center gap-1.5 self-start rounded-lg border border-surface-border bg-surface-secondary px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
    >
      {/* Cloud or device icon */}
      {isCloud ? (
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ) : (
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
        </svg>
      )}

      <span className="max-w-[180px] truncate">{name}</span>

      {/* Swap icon */}
      <svg className="h-3 w-3 shrink-0 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    </button>
  );
}
