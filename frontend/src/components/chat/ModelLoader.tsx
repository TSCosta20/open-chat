"use client";

import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";

interface Props {
  chatId: string;
}

export function ModelLoader({ chatId }: Props) {
  const model = useChatStore((s) => s.getModelForChat(chatId));
  const modelReady = useChatStore((s) => s.modelReady);
  const progress = useChatStore((s) => s.modelLoadProgress);
  const status = useChatStore((s) => s.modelLoadStatus);
  const cap = useDeviceCapability();

  if (!cap.ready) return null;

  if (!cap.hasWebGPU) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          WebGPU is not supported in this browser. Please use Chrome 113+ or Edge to run models locally.
        </div>
      </div>
    );
  }

  if (modelReady) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-3">
      <div className="rounded-xl border border-surface-border bg-surface-secondary p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-300 font-medium">Loading model…</span>
          <span className="text-slate-500 text-xs">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-surface-primary overflow-hidden">
          <div
            className={clsx(
              "h-full rounded-full transition-all duration-300",
              progress < 100 ? "bg-accent" : "bg-green-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="text-xs text-slate-500 truncate">{status}</p>
        <p className="text-xs text-slate-600">
          Models are cached on your device after the first download.
        </p>
      </div>
    </div>
  );
}
