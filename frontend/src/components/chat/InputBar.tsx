"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { useChat } from "@/hooks/useChat";
import { useVoiceInput, stopSpeaking } from "@/hooks/useVoiceInput";
import { ModelSelector } from "./ModelSelector";
import { ModelLoader } from "./ModelLoader";
import { ALL_MODELS } from "@/types";

interface Props {
  chatId: string;
  centered?: boolean;
}

export function InputBar({ chatId, centered = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming[chatId] ?? false);
  const modelReady = useChatStore((s) => s.modelReady);
  const selectedModel = useChatStore((s) => (mounted ? s.getModelForChat(chatId) : ""));
  const cloudInUse = useChatStore((s) => s.cloudModelInUse[chatId] ?? null);
  const { sendMessage } = useChat(chatId);

  useEffect(() => setMounted(true), []);

  const modelDef = ALL_MODELS.find((m) => m.id === selectedModel);
  const disclaimer =
    modelDef?.backend === "cloud"
      ? cloudInUse?.label
        ? `Cloud · using ${cloudInUse.label}`
        : modelDef.cloudModelId?.startsWith("gemini-")
          ? "Responses processed by Google Gemini"
          : modelDef.cloudModelId === "auto"
            ? "Cloud · best available"
            : "Responses processed by cloud inference"
      : modelDef?.backend === "chrome-ai"
        ? "Runs in Chrome's built-in AI — no data leaves your device"
        : "Runs entirely on your device · no data leaves your browser";

  const disabled = isStreaming || !modelReady;

  const handleSubmit = useCallback(
    async (text?: string, speak = false) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || disabled) return;
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      await sendMessage(trimmed, speak);
    },
    [input, disabled, sendMessage]
  );

  const { isListening, startListening, stopListening, supported } = useVoiceInput(
    (transcript) => {
      setInput(transcript);
      if (voiceMode) {
        handleSubmit(transcript, true);
      }
    }
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function toggleVoiceMode() {
    if (voiceMode) {
      stopSpeaking();
      stopListening();
      setVoiceMode(false);
    } else {
      setVoiceMode(true);
      startListening();
    }
  }

  return (
    <div className={clsx(
      centered ? "w-full max-w-2xl mx-auto px-4" : "border-t border-surface-border bg-surface"
    )}>
      <ModelLoader chatId={chatId} />

      <div className={clsx("px-4 py-3", centered && "px-0")}>
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <ModelSelector chatId={chatId} />

          <div
            className={clsx(
              "flex items-end gap-2 rounded-2xl border bg-surface-secondary px-4 py-2 transition-colors",
              disabled
                ? "border-surface-border opacity-60"
                : "border-surface-border focus-within:border-accent",
              centered && "shadow-lg"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              rows={1}
              placeholder={
                isListening
                  ? "Listening..."
                  : !modelReady
                    ? "Waiting for model to load..."
                    : isStreaming
                      ? "Waiting for response..."
                      : "Ask anything"
              }
              className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none disabled:cursor-not-allowed"
              style={{ maxHeight: "200px" }}
            />

            {supported && (
              <button
                onClick={isListening ? stopListening : (voiceMode ? toggleVoiceMode : startListening)}
                disabled={disabled}
                className={clsx(
                  "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : voiceMode
                      ? "bg-accent/20 text-accent"
                      : "text-slate-500 hover:text-slate-300 disabled:cursor-not-allowed"
                )}
                aria-label={isListening ? "Stop recording" : "Dictate — speak to fill the text box"}
                title={isListening ? "Stop recording" : voiceMode ? "Recording (voice mode on)" : "Dictate — speak to fill the text box"}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V22H8v2h8v-2h-3v-1.06A9 9 0 0 0 21 12v-2h-2z" />
                </svg>
              </button>
            )}

            {supported && (
              <button
                onClick={toggleVoiceMode}
                disabled={disabled}
                className={clsx(
                  "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  voiceMode
                    ? "bg-accent text-white"
                    : "text-slate-500 hover:text-slate-300 disabled:cursor-not-allowed"
                )}
                aria-label={voiceMode ? "Stop live conversation" : "Live conversation — speak and hear replies"}
                title={voiceMode ? "Live conversation on — click to stop" : "Live conversation — speak and hear replies automatically"}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              </button>
            )}

            <button
              onClick={() => handleSubmit()}
              disabled={disabled || !input.trim()}
              className={clsx(
                "mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                disabled || !input.trim()
                  ? "text-slate-600 cursor-not-allowed"
                  : "bg-accent text-white hover:bg-accent-hover"
              )}
              aria-label="Send message"
            >
              {isStreaming ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-slate-600">{disclaimer}</p>
            <p className="text-xs text-slate-700">Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </div>
  );
}
