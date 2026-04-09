"use client";

import { useEffect, useState } from "react";
import { AVAILABLE_MODELS, DEFAULT_MODEL, type ModelId } from "@/types";

export interface DeviceCapability {
  /** Raw estimated VRAM from WebGPU adapter (GB) */
  estimatedVramGB: number;
  /** navigator.deviceMemory in GB */
  deviceMemoryGB: number;
  /** Safe VRAM budget for browser (WebGPU) inference */
  vramBudgetGB: number;
  /** Safe RAM budget for Ollama CPU inference — tighter than vramBudgetGB */
  ramBudgetGB: number;
  /** True when estimated VRAM < 4 GB — integrated GPU / weak CPU */
  isLowEnd: boolean;
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
    const isLowEnd = deviceMemoryGB < 8;
    return {
      estimatedVramGB: 0,
      deviceMemoryGB,
      vramBudgetGB: 0,
      ramBudgetGB: deviceMemoryGB / (isLowEnd ? 12 : 5),
      isLowEnd,
      hasWebGPU: false,
      recommendedModel: DEFAULT_MODEL,
      ready: true,
    };
  }

  let estimatedVramGB = 2; // conservative default
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter) {
      // maxBufferSize is a reliable proxy for VRAM budget
      // Typical values: ~256 MB (very low), ~2-3 GB (integrated), 4 GB+ (dedicated)
      estimatedVramGB = adapter.limits.maxBufferSize / (1024 ** 3);
    }
  } catch {
    // WebGPU present but adapter unavailable
  }

  // Low-end = integrated GPU (< 4 GB). These machines also have weak CPUs,
  // so Ollama CPU inference is slow even for very small models.
  const isLowEnd = estimatedVramGB < 4;

  // WebGPU budget:
  //   Normal  → 45% of VRAM (OS + browser take the rest)
  //   Low-end → 35% (less headroom available, less capable GPU)
  const vramBudgetGB = estimatedVramGB * (isLowEnd ? 0.35 : 0.45);

  // Ollama CPU budget — much tighter because:
  //   1. CPU inference needs free RAM to avoid page swapping
  //   2. Low-end CPUs are too slow for anything but the very smallest models
  //   Normal  → deviceMemory / 5  (~1.6 GB on 8 GB machines)
  //   Low-end → deviceMemory / 12 (~0.67 GB on 8 GB) — blocks models ≥ ~0.45 GB
  const ramBudgetGB = deviceMemoryGB / (isLowEnd ? 12 : 5);

  const budget = Math.min(vramBudgetGB, ramBudgetGB);
  const sorted = [...AVAILABLE_MODELS].sort((a, b) => b.vramGB - a.vramGB);
  const best = sorted.find((m) => m.vramGB <= budget && m.minRamGB <= deviceMemoryGB);
  const recommendedModel = best?.id ?? DEFAULT_MODEL;

  return {
    estimatedVramGB,
    deviceMemoryGB,
    vramBudgetGB,
    ramBudgetGB,
    isLowEnd,
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
    isLowEnd: false,
    hasWebGPU: false,
    recommendedModel: DEFAULT_MODEL,
    ready: false,
  });

  useEffect(() => {
    detectCapability().then(setCap);
  }, []);

  return cap;
}
