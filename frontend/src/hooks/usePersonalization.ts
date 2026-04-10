"use client";

import { useCallback, useEffect, useState } from "react";

export type PersonalizationLevel = "low" | "medium" | "high";

const STORAGE_KEY_LEVEL = "oc_personalization_level";
const STORAGE_KEY_INSTRUCTIONS = "oc_personalization_instructions";

function read(key: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(key) ?? "";
}

function write(key: string, value: string) {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(key, trimmed);
  else localStorage.removeItem(key);
}

export function getStoredPersonalization(): {
  level: PersonalizationLevel;
  instructions: string;
} {
  const levelRaw = read(STORAGE_KEY_LEVEL) as PersonalizationLevel;
  const level: PersonalizationLevel =
    levelRaw === "low" || levelRaw === "medium" || levelRaw === "high" ? levelRaw : "low";
  return {
    level,
    instructions: read(STORAGE_KEY_INSTRUCTIONS),
  };
}

export function usePersonalization(): {
  level: PersonalizationLevel;
  instructions: string;
  saveLevel: (lvl: PersonalizationLevel) => void;
  saveInstructions: (text: string) => void;
} {
  const [level, setLevel] = useState<PersonalizationLevel>("low");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    const stored = getStoredPersonalization();
    setLevel(stored.level);
    setInstructions(stored.instructions);
  }, []);

  const saveLevel = useCallback((lvl: PersonalizationLevel) => {
    write(STORAGE_KEY_LEVEL, lvl);
    setLevel(lvl);
  }, []);

  const saveInstructions = useCallback((text: string) => {
    write(STORAGE_KEY_INSTRUCTIONS, text);
    setInstructions(text.trim());
  }, []);

  return { level, instructions, saveLevel, saveInstructions };
}

