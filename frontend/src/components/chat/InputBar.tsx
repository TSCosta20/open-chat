"use client";

import { useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { useChatStore } from "@/store/useChatStore";
import { useChat } from "@/hooks/useChat";
import { ModelSelector } from "./ModelSelector";
import { ModelLoader } from "./ModelLoader";

interface Props {
  chatId: string;
}

export function InputBar({ chatId }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming[chatId] ?? false);
  const modelReady = useChatStore((s) => s.modelReady);
  const { sendMessage } = useChat(chatId);

  const disabled = isStreaming || !modelReady;

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(trimmed);
  }, [input, disabled, sendMessage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  return (
    <div className="border-t border-surface-border bg-surface">
      {/* Model loading progress — shown above input while loading */}
      <ModelLoader chatId={chatId} />

      <div className="px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {/* Model selector row */}
          <ModelSelector chatId={chatId} />

          {/* Input row */}
          <div
            className={clsx(
              "flex items-end gap-2 rounded-2xl border bg-surface-secondary px-4 py-2 transition-colors",
              disabled
                ? "border-surface-border opacity-60"
                : "border-surface-border focus-within:border-accent"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              rows={1}
              placeholder={
                !modelReady
                  ? "Waiting for model to load…"
                  : isStreaming
                  ? "Waiting for response…"
                  : "Message (Enter to send, Shift+Enter for newline)"
              }
              className="flex-1 resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none disabled:cursor-not-allowed"
              style={{ maxHeight: "200px" }}
            />

            <button
              onClick={handleSubmit}
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

          <p className="text-center text-xs text-slate-600">
            Runs entirely on your device · no data leaves your browser
          </p>
        </div>
      </div>
    </div>
  );
}
