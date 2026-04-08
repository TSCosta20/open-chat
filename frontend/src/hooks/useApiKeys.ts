"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_OPENROUTER = "oc_openrouter_key";
const STORAGE_KEY_GEMINI     = "oc_gemini_key";

function readKey(storageKey: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(storageKey) ?? "";
}

function writeKey(storageKey: string, value: string) {
  if (value.trim()) {
    localStorage.setItem(storageKey, value.trim());
  } else {
    localStorage.removeItem(storageKey);
  }
}

export function useApiKeys() {
  const [openRouterKey, setOpenRouterKeyState] = useState("");
  const [geminiKey,     setGeminiKeyState]     = useState("");

  useEffect(() => {
    setOpenRouterKeyState(readKey(STORAGE_KEY_OPENROUTER));
    setGeminiKeyState(readKey(STORAGE_KEY_GEMINI));
  }, []);

  const saveOpenRouterKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_OPENROUTER, key);
    setOpenRouterKeyState(key.trim());
  }, []);

  const saveGeminiKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_GEMINI, key);
    setGeminiKeyState(key.trim());
  }, []);

  return { openRouterKey, geminiKey, saveOpenRouterKey, saveGeminiKey };
}

/** Read keys synchronously for use outside React (e.g. in useChat). */
export function getStoredApiKeys() {
  return {
    openRouterKey: readKey(STORAGE_KEY_OPENROUTER),
    geminiKey:     readKey(STORAGE_KEY_GEMINI),
  };
}
