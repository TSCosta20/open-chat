"use client";

import { useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { AVAILABLE_MODELS } from "@/types";

interface Props {
  chatId: string;
}

export function ModelSelector({ chatId }: Props) {
  const model = useChatStore((s) => s.getModelForChat(chatId));
  const setModelForChat = useChatStore((s) => s.setModelForChat);
  const cap = useDeviceCapability();

  // Auto-select recommended model on first load
  useEffect(() => {
    if (cap.ready) {
      const current = useChatStore.getState().selectedModel[chatId];
      if (!current) {
        setModelForChat(chatId, cap.recommendedModel);
      }
    }
  }, [cap.ready, cap.recommendedModel, chatId, setModelForChat]);

  const selectedDef = AVAILABLE_MODELS.find((m) => m.id === model);

  return (
    <div className="flex items-center gap-2">
      <select
        value={model}
        onChange={(e) => setModelForChat(chatId, e.target.value)}
        className="rounded-lg border border-surface-border bg-surface-secondary px-3 py-1.5 text-xs text-slate-300 outline-none transition-colors hover:border-slate-500 focus:border-accent focus:ring-1 focus:ring-accent"
        title="Select AI model"
      >
        {AVAILABLE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.id === cap.recommendedModel ? " ★" : ""}
          </option>
        ))}
      </select>

      {/* Warning when selected model exceeds device capability */}
      {cap.ready && selectedDef && selectedDef.vramGB > cap.estimatedVramGB * 0.85 && (
        <span
          title={`This model needs ~${selectedDef.vramGB}GB VRAM but your device appears to have ~${cap.estimatedVramGB.toFixed(1)}GB`}
          className="cursor-help text-xs text-amber-400"
        >
          ⚠ may be slow
        </span>
      )}

      {/* VRAM hint */}
      {selectedDef && (
        <span className="text-xs text-slate-600">
          ~{selectedDef.vramGB.toFixed(1)}GB VRAM
        </span>
      )}
    </div>
  );
}
