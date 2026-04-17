"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MessageBubble, StreamingBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  chatId: string;
}

export function ChatWindow({ chatId }: Props) {
  const [mounted, setMounted] = useState(false);
  const messages = useChatStore((s) => s.messages[chatId] ?? []);
  const streamingContent = useChatStore((s) => s.streamingContent[chatId]);
  const isStreaming = useChatStore((s) => s.isStreaming[chatId] ?? false);
  const cloudStatus = useChatStore((s) => s.cloudStatus[chatId] ?? "");
  const cloudModel = useChatStore((s) => s.cloudModelInUse[chatId]);
  const cloudUsage = useChatStore((s) => s.cloudUsage[chatId]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useAutoScroll(bottomRef, [messages, streamingContent]);

  const showTypingDots = isStreaming && !streamingContent && !cloudStatus;
  const showCloudMeta = !!cloudModel && (isStreaming || !!cloudStatus || !!streamingContent);

  function formatReset(reset: unknown): string | null {
    if (!mounted) return null;

    const n = typeof reset === "number" ? reset : Number(reset);
    if (!Number.isFinite(n) || n <= 0) return null;

    const ms = n > 1_000_000_000 ? n * 1000 : Date.now() + n * 1000;
    const d = new Date(ms);

    if (n <= 24 * 60 * 60) {
      const mins = Math.max(1, Math.round(n / 60));
      return `reset ~${mins}m`;
    }

    return `reset ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function formatUsage(): string | null {
    if (!cloudUsage) return null;
    const req = (cloudUsage as any).requests;
    const tok = (cloudUsage as any).tokens;

    const parts: string[] = [];
    if (req?.limit != null && req?.remaining != null) {
      const used = Math.max(0, Number(req.limit) - Number(req.remaining));
      const reset = formatReset(req.reset);
      parts.push(`${used}/${req.limit} req${reset ? ` (${reset})` : ""}`);
    }
    if (tok?.limit != null && tok?.remaining != null) {
      const used = Math.max(0, Number(tok.limit) - Number(tok.remaining));
      const reset = formatReset(tok.reset);
      parts.push(`${used}/${tok.limit} tok${reset ? ` (${reset})` : ""}`);
    }
    return parts.length ? parts.join(" / ") : null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin">
      {messages.length === 0 && !isStreaming ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-slate-600 text-center">Type below to start chatting</p>
        </div>
      ) : (
        <div className="flex flex-col py-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {showTypingDots && <TypingIndicator />}
          {showCloudMeta && (
            <div className="px-4 pt-1 pb-1 text-[11px] text-slate-600">
              <span className="text-slate-500">Model:</span>{" "}
              <span className="text-slate-400">{cloudModel.label}</span>{" "}
              <span className="text-slate-700">({cloudModel.provider})</span>
              {formatUsage() && (
                <>
                  <span className="text-slate-700"> — </span>
                  <span className="text-slate-500">{formatUsage()}</span>
                </>
              )}
            </div>
          )}
          {cloudStatus && !streamingContent && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 italic">
              <span className="inline-flex gap-0.5">
                <span className="animate-bounce [animation-delay:0ms]">·</span>
                <span className="animate-bounce [animation-delay:150ms]">·</span>
                <span className="animate-bounce [animation-delay:300ms]">·</span>
              </span>
              {cloudStatus}
            </div>
          )}
          {streamingContent && <StreamingBubble content={streamingContent} />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
