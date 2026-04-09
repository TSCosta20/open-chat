"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_OPENROUTER = "oc_openrouter_key";
const STORAGE_KEY_GEMINI     = "oc_gemini_key";
const STORAGE_KEY_GROQ       = "oc_groq_key";
const STORAGE_KEY_TOGETHER   = "oc_together_key";
const STORAGE_KEY_FIREWORKS  = "oc_fireworks_key";
const STORAGE_KEY_HF         = "oc_huggingface_key";
const STORAGE_KEY_PUTER      = "oc_puter_key";
const STORAGE_KEY_ROUTER_KEY = "oc_router_key";
const STORAGE_KEY_ROUTER_URL = "oc_router_base_url";

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
  const [groqKey,       setGroqKeyState]       = useState("");
  const [togetherKey,   setTogetherKeyState]   = useState("");
  const [fireworksKey,  setFireworksKeyState]  = useState("");
  const [huggingFaceKey, setHuggingFaceKeyState] = useState("");
  const [puterKey,      setPuterKeyState]      = useState("");
  const [routerKey,     setRouterKeyState]     = useState("");
  const [routerBaseUrl, setRouterBaseUrlState] = useState("");

  useEffect(() => {
    setOpenRouterKeyState(readKey(STORAGE_KEY_OPENROUTER));
    setGeminiKeyState(readKey(STORAGE_KEY_GEMINI));
    setGroqKeyState(readKey(STORAGE_KEY_GROQ));
    setTogetherKeyState(readKey(STORAGE_KEY_TOGETHER));
    setFireworksKeyState(readKey(STORAGE_KEY_FIREWORKS));
    setHuggingFaceKeyState(readKey(STORAGE_KEY_HF));
    setPuterKeyState(readKey(STORAGE_KEY_PUTER));
    setRouterKeyState(readKey(STORAGE_KEY_ROUTER_KEY));
    setRouterBaseUrlState(readKey(STORAGE_KEY_ROUTER_URL));
  }, []);

  const saveOpenRouterKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_OPENROUTER, key);
    setOpenRouterKeyState(key.trim());
  }, []);

  const saveGeminiKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_GEMINI, key);
    setGeminiKeyState(key.trim());
  }, []);

  const saveGroqKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_GROQ, key);
    setGroqKeyState(key.trim());
  }, []);

  const saveTogetherKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_TOGETHER, key);
    setTogetherKeyState(key.trim());
  }, []);

  const saveFireworksKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_FIREWORKS, key);
    setFireworksKeyState(key.trim());
  }, []);

  const saveHuggingFaceKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_HF, key);
    setHuggingFaceKeyState(key.trim());
  }, []);

  const savePuterKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_PUTER, key);
    setPuterKeyState(key.trim());
  }, []);

  const saveRouterKey = useCallback((key: string) => {
    writeKey(STORAGE_KEY_ROUTER_KEY, key);
    setRouterKeyState(key.trim());
  }, []);

  const saveRouterBaseUrl = useCallback((url: string) => {
    writeKey(STORAGE_KEY_ROUTER_URL, url);
    setRouterBaseUrlState(url.trim());
  }, []);

  return {
    openRouterKey,
    geminiKey,
    groqKey,
    togetherKey,
    fireworksKey,
    huggingFaceKey,
    puterKey,
    routerKey,
    routerBaseUrl,
    saveOpenRouterKey,
    saveGeminiKey,
    saveGroqKey,
    saveTogetherKey,
    saveFireworksKey,
    saveHuggingFaceKey,
    savePuterKey,
    saveRouterKey,
    saveRouterBaseUrl,
  };
}

/** Read keys synchronously for use outside React (e.g. in useChat). */
export function getStoredApiKeys() {
  return {
    openRouterKey: readKey(STORAGE_KEY_OPENROUTER),
    geminiKey:     readKey(STORAGE_KEY_GEMINI),
    groqKey:       readKey(STORAGE_KEY_GROQ),
    togetherKey:   readKey(STORAGE_KEY_TOGETHER),
    fireworksKey:  readKey(STORAGE_KEY_FIREWORKS),
    huggingFaceKey: readKey(STORAGE_KEY_HF),
    puterKey:      readKey(STORAGE_KEY_PUTER),
    routerKey:     readKey(STORAGE_KEY_ROUTER_KEY),
    routerBaseUrl: readKey(STORAGE_KEY_ROUTER_URL),
  };
}
