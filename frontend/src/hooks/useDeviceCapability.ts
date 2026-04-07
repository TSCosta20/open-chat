"use client";

import { useEffect, useState } from "react";
import { AVAILABLE_MODELS, DEFAULT_MODEL, type ModelId } from "@/types";

export interface DeviceCapability {
  /** Estimated VRAM budget in GB (from WebGPU maxBufferSize heuristic) */
  estimatedVramGB: number;
  /** navigator.deviceMemory in GB (rounded, may be undefined) */
  deviceMemoryGB: number;
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

  // Pick the best model that fits within (vram * 0.85) to leave headroom,
  // also gated by deviceMemory
  const budget = Math.min(estimatedVramGB * 0.85, deviceMemoryGB / 2);
  const sorted = [...AVAILABLE_MODELS].sort((a, b) => b.vramGB - a.vramGB);
  const best = sorted.find((m) => m.vramGB <= budget && m.minRamGB <= deviceMemoryGB);
  const recommendedModel = best?.id ?? DEFAULT_MODEL;

  return {
    estimatedVramGB,
    deviceMemoryGB,
    hasWebGPU: true,
    recommendedModel,
    ready: true,
  };
}

export function useDeviceCapability(): DeviceCapability {
  const [cap, setCap] = useState<DeviceCapability>({
    estimatedVramGB: 0,
    deviceMemoryGB: 4,
    hasWebGPU: false,
    recommendedModel: DEFAULT_MODEL,
    ready: false,
  });

  useEffect(() => {
    detectCapability().then(setCap);
  }, []);

  return cap;
}
