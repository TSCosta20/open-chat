"use client";

import { useEffect, useState } from "react";
import { AVAILABLE_MODELS, DEFAULT_MODEL, type ModelId } from "@/types";

export interface DeviceCapability {
  /** Estimated VRAM budget in GB (from WebGPU maxBufferSize heuristic) */
  estimatedVramGB: number;
  /** navigator.deviceMemory in GB (rounded, may be undefined) */
  deviceMemoryGB: number;
  /** Conservative VRAM budget (65% of estimated — safe threshold for browser inference) */
  vramBudgetGB: number;
  /** Conservative RAM budget for Ollama models (deviceMemory / 2.5) */
  ramBudgetGB: number;
  /** WebGPU supported */
  hasWebGPU: boolean;
  /** Best model ID that fits within device limits */
  recommendedModel: ModelId;
  /** Detection complete */
  ready: boolean;
}

async function detectCapability(): Promise<DeviceCapability> {
  const deviceMemoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (!("gpu" in navigator)) {
    return {
      estimatedVramGB: 0,
      deviceMemoryGB,
      vramBudgetGB: 0,
      ramBudgetGB: deviceMemoryGB / 2.5,
      hasWebGPU: false,
      recommendedModel: DEFAULT_MODEL,
      ready: true,
    };
  }

  let estimatedVramGB = 2; // conservative default
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) {
      const limits = adapter.limits;
      // maxBufferSize is a reliable proxy for VRAM budget
      // Typical values: 256MB (low), 2GB (mid), 4GB+ (high)
      estimatedVramGB = limits.maxBufferSize / (1024 ** 3);
    }
  } catch {
    // WebGPU present but adapter unavailable (headless, etc.)
  }

  // Conservative budgets — leave significant headroom to avoid crashes:
  // - 65% of VRAM for browser inference (browser itself + OS need the rest)
  // - deviceMemory / 2.5 for Ollama (OS + browser + model overhead)
  const vramBudgetGB = estimatedVramGB * 0.65;
  const ramBudgetGB  = deviceMemoryGB / 2.5;
  const budget = Math.min(vramBudgetGB, ramBudgetGB);

  const sorted = [...AVAILABLE_MODELS].sort((a, b) => b.vramGB - a.vramGB);
  const best = sorted.find((m) => m.vramGB <= budget && m.minRamGB <= deviceMemoryGB);
  const recommendedModel = best?.id ?? DEFAULT_MODEL;

  return {
    estimatedVramGB,
    deviceMemoryGB,
    vramBudgetGB,
    ramBudgetGB,
    hasWebGPU: true,
    recommendedModel,
    ready: true,
  };
}

export function useDeviceCapability(): DeviceCapability {
  const [cap, setCap] = useState<DeviceCapability>({
    estimatedVramGB: 0,
    deviceMemoryGB: 4,
    vramBudgetGB: 0,
    ramBudgetGB: 0,
    hasWebGPU: false,
    recommendedModel: DEFAULT_MODEL,
    ready: false,
  });

  useEffect(() => {
    detectCapability().then(setCap);
  }, []);

  return cap;
}
